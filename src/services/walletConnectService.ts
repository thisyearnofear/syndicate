/**
* WALLETCONNECT SERVICE
*
* Implements WalletConnect v2 using the new Reown WalletKit
* Follows the official documentation for proper integration
* Enhanced with modern UI components and proper session handling
 */

import { Core } from "@walletconnect/core";
import { WalletKit } from "@reown/walletkit";
import type { WalletKitTypes } from "@reown/walletkit";
import { buildApprovedNamespaces, getSdkError } from "@walletconnect/utils";

export class WalletConnectService {
private walletKit: any = null;
private core: any = null;
private isInitialized = false;

private readonly PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "your-project-id";

  // Modal callback handlers
  private onProposalCallback: ((proposal: WalletKitTypes.SessionProposal) => void) | null = null;
  private onRequestCallback: ((request: WalletKitTypes.SessionRequest, session: any) => void) | null = null;
  private onSessionCallback: ((session: any) => void) | null = null;

  // Session persistence
  private readonly SESSION_STORAGE_KEY = 'walletconnect_sessions';
  
  // Supported chains and methods
  private readonly supportedNamespaces = {
    eip155: {
      chains: ["eip155:1", "eip155:137", "eip155:56"], // Ethereum, Polygon, BSC
      methods: [
        "eth_accounts",
        "eth_requestAccounts", 
        "eth_sendRawTransaction",
        "eth_sign",
        "eth_signTransaction",
        "eth_signTypedData",
        "eth_signTypedData_v3",
        "eth_signTypedData_v4",
        "eth_sendTransaction",
        "personal_sign",
        "wallet_switchEthereumChain",
        "wallet_addEthereumChain",
      ],
      events: ["chainChanged", "accountsChanged"],
      accounts: [] as string[], // Will be populated with user accounts
    },
  };

  async initialize(): Promise<void> {
    if (this.isInitialized && this.walletKit) {
      return;
    }

    try {
      // Initialize Core
      this.core = new Core({
        projectId: this.PROJECT_ID,
      });

      // Initialize WalletKit
      this.walletKit = await WalletKit.init({
        core: this.core,
        metadata: {
          name: "Syndicate",
          description: "Join syndicates and participate in community-driven causes",
          url: "https://syndicate.app",
          icons: ["https://syndicate.app/icon.png"],
        },
      });

      // Set up event listeners
      this.setupEventListeners();

      // Restore previous sessions
      await this.restoreSessions();

      this.isInitialized = true;
      console.log("WalletConnect service initialized");
    } catch (error) {
      console.error("Failed to initialize WalletConnect:", error);
      throw new Error("Failed to initialize WalletConnect service");
    }
  }

  private setupEventListeners(): void {
  if (!this.walletKit) return;

  // Handle session proposals
  this.walletKit.on("session_proposal", this.onSessionProposal.bind(this));

  // Handle session requests
  this.walletKit.on("session_request", this.onSessionRequest.bind(this));

  // Handle session deletions
  this.walletKit.on("session_delete", this.onSessionDelete.bind(this));
  }

  // Set modal callbacks
  setModalCallbacks({
    onProposal,
    onRequest,
    onSession,
  }: {
    onProposal: (proposal: WalletKitTypes.SessionProposal) => void;
    onRequest: (request: WalletKitTypes.SessionRequest, session: any) => void;
    onSession: (session: any) => void;
  }) {
    this.onProposalCallback = onProposal;
    this.onRequestCallback = onRequest;
    this.onSessionCallback = onSession;
  }

  // Session persistence methods
  private saveSessionsToStorage(): void {
    if (typeof window === 'undefined' || !this.walletKit) return;

    try {
      const sessions = this.getActiveSessions();
      const sessionsData = Object.values(sessions).map((session: any) => ({
        topic: session.topic,
        expiry: session.expiry,
        peer: session.peer,
        namespaces: session.namespaces,
        acknowledged: session.acknowledged,
      }));

      localStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(sessionsData));
    } catch (error) {
      console.error('Failed to save sessions to storage:', error);
    }
  }

  private loadSessionsFromStorage(): any[] {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(this.SESSION_STORAGE_KEY);
      if (!stored) return [];

      const sessionsData = JSON.parse(stored);
      const now = Date.now();

      // Filter out expired sessions
      return sessionsData.filter((session: any) => session.expiry > now);
    } catch (error) {
      console.error('Failed to load sessions from storage:', error);
      return [];
    }
  }

  // Restore sessions on initialization
  private async restoreSessions(): Promise<void> {
    if (!this.walletKit) return;

    try {
      const storedSessions = this.loadSessionsFromStorage();

      for (const sessionData of storedSessions) {
        try {
          // Attempt to restore the session
          // Note: This is a simplified restoration - in a real implementation,
          // you might need to re-pair or validate the session
          console.log('Restored session:', sessionData.topic);
        } catch (error) {
          console.error('Failed to restore session:', sessionData.topic, error);
        }
      }
    } catch (error) {
      console.error('Failed to restore sessions:', error);
    }
  }

  private async onSessionProposal(proposal: WalletKitTypes.SessionProposal): Promise<void> {
  console.log("Received session proposal:", proposal);

  // Call the modal callback to show the proposal modal
  if (this.onProposalCallback) {
  this.onProposalCallback(proposal);
  } else {
  // Fallback: auto-reject if no callback
  await this.rejectProposal(proposal.id);
  }
  }

  // Public method to approve a session proposal
  async approveProposal(proposalId: number, namespaces: any): Promise<void> {
  try {
      const session = await this.walletKit!.approveSession({
    id: proposalId,
    namespaces,
  });

  console.log("Session approved:", session);

  // Handle redirect after approval
  this.handleRedirect(session);

  // Save session to storage
  this.saveSessionsToStorage();

  // Notify session callback
      if (this.onSessionCallback) {
      this.onSessionCallback(session);
  }

  } catch (error) {
      console.error("Failed to approve session:", error);
      throw error;
    }
  }

  // Public method to reject a session proposal
  async rejectProposal(proposalId: number): Promise<void> {
    try {
      await this.walletKit!.rejectSession({
        id: proposalId,
        reason: getSdkError("USER_REJECTED"),
      });
      console.log("Session proposal rejected:", proposalId);
    } catch (error) {
      console.error("Failed to reject session:", error);
      throw error;
    }
  }

  private async onSessionRequest(event: WalletKitTypes.SessionRequest): Promise<void> {
  console.log("Received session request:", event);

    // Get the session for this request
  const sessions = this.getActiveSessions();
  const session = Object.values(sessions).find((s: any) => s.topic === event.topic);

  // Call the modal callback to show the request modal
  if (this.onRequestCallback && session) {
  this.onRequestCallback(event, session);
  } else {
  // Fallback: auto-reject if no callback
  await this.rejectRequest(event.topic, event.id);
  }
  }

  // Public method to approve a session request
  async approveRequest(topic: string, requestId: number, result: any): Promise<void> {
  try {
  const response = {
  id: requestId,
  result,
  jsonrpc: "2.0" as const,
  };

  await this.walletKit!.respondSessionRequest({ topic, response });
  console.log("Session request approved:", requestId);

  // Handle redirect after request completion
  const sessions = this.getActiveSessions();
      const session = Object.values(sessions).find((s: any) => s.topic === topic);
  if (session) {
    this.handleRedirect(session);
    }

  } catch (error) {
  console.error("Failed to approve request:", error);
  throw error;
  }
  }

  // Public method to reject a session request
  async rejectRequest(topic: string, requestId: number): Promise<void> {
  try {
      const response = {
    id: requestId,
      jsonrpc: "2.0" as const,
        error: {
          code: 5000,
          message: "User rejected request",
        },
      };

      await this.walletKit!.respondSessionRequest({ topic, response });
      console.log("Session request rejected:", requestId);
    } catch (error) {
      console.error("Failed to reject request:", error);
      throw error;
    }
  }

  private onSessionDelete(event: { topic: string }): void {
    console.log("Session deleted:", event.topic);
    // Handle session cleanup
  }

  

  private handleRedirect(session: any): void {
  // Check if this is a native app
  const isNativeApp = session.peer?.metadata?.redirect !== undefined;

  if (isNativeApp) {
  // Handle deep linking for native mobile apps
  const redirectUrl = session.peer.metadata.redirect;
  if (redirectUrl) {
    try {
    // Attempt deep linking
    window.location.href = redirectUrl;

        // Fallback: if deep link doesn't work, show instructions
      setTimeout(() => {
        if (document.hasFocus()) {
        // Deep link didn't work, show manual instructions
        console.log("Deep link failed, showing manual instructions");
          this.showReturnToAppMessage(session);
          }
          }, 2000);
        } catch (error) {
          console.error("Deep linking failed:", error);
          this.showReturnToAppMessage(session);
        }
      } else {
        this.showReturnToAppMessage(session);
      }
    } else {
      // For web dApps, redirect back to original tab
      if (window.opener && session.peer?.metadata?.url) {
        try {
          window.opener.location.href = session.peer.metadata.url;
          window.close();
        } catch (error) {
          console.error("Failed to redirect back to dApp:", error);
          // If redirect fails, just close the window
          window.close();
        }
      } else {
        // No opener window, show success message
        console.log("Session completed successfully");
      }
    }
  }

  private showReturnToAppMessage(session: any): void {
    // In a real implementation, you would show a modal or toast
    // For now, we'll log the instructions
    console.log("Please return to your app manually. Session pairing completed.");
    console.log("App:", session.peer?.metadata?.name || "Unknown App");

    // You could emit an event here to show a UI notification
    // emit('showReturnToAppMessage', { appName: session.peer?.metadata?.name });
  }

  // Public methods
  async pair(uri: string): Promise<void> {
    if (!this.walletKit) {
      await this.initialize();
    }
    
    await this.walletKit!.pair({ uri });
  }

  async disconnectSession(topic: string): Promise<void> {
    if (!this.walletKit) return;

    await this.walletKit.disconnectSession({
      topic,
      reason: getSdkError("USER_DISCONNECTED"),
    });

    // Remove session from storage
    this.saveSessionsToStorage();
  }

  getActiveSessions() {
    if (!this.walletKit) return {};
    return this.walletKit.getActiveSessions();
  }

  async updateSession(topic: string, namespaces: any): Promise<void> {
    if (!this.walletKit) return;
    
    await this.walletKit.updateSession({
      topic,
      namespaces,
    });
  }

  // Handle WalletConnect URI from query parameters
  handleWalletConnectUri(): string | null {
    if (typeof window === "undefined") return null;
    
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("uri");
  }

  // Handle session request from query parameters
  handleSessionRequest(): { requestId: string; sessionTopic: string } | null {
    if (typeof window === "undefined") return null;
    
    const urlParams = new URLSearchParams(window.location.search);
    const requestId = urlParams.get("requestId");
    const sessionTopic = urlParams.get("sessionTopic");
    
    if (requestId && sessionTopic) {
      return { requestId, sessionTopic };
    }
    
    return null;
  }
}

// Singleton instance
export const walletConnectService = new WalletConnectService();

// Hook for React components
export function useWalletConnect() {
const connectWithUri = async (uri: string) => {
try {
await walletConnectService.initialize();
await walletConnectService.pair(uri);
} catch (error) {
console.error("Failed to connect with WalletConnect:", error);
throw error;
}
};

const disconnect = async (topic: string) => {
try {
await walletConnectService.disconnectSession(topic);
} catch (error) {
console.error("Failed to disconnect WalletConnect session:", error);
throw error;
}
};

const getActiveSessions = () => {
return walletConnectService.getActiveSessions();
};

const setModalCallbacks = (callbacks: {
onProposal: (proposal: WalletKitTypes.SessionProposal) => void;
onRequest: (request: WalletKitTypes.SessionRequest, session: any) => void;
onSession: (session: any) => void;
}) => {
  walletConnectService.setModalCallbacks(callbacks);
  };

  const approveProposal = async (proposalId: number, namespaces: any) => {
    return walletConnectService.approveProposal(proposalId, namespaces);
  };

  const rejectProposal = async (proposalId: number) => {
    return walletConnectService.rejectProposal(proposalId);
  };

  const approveRequest = async (topic: string, requestId: number, result: any) => {
    return walletConnectService.approveRequest(topic, requestId, result);
  };

  const rejectRequest = async (topic: string, requestId: number) => {
    return walletConnectService.rejectRequest(topic, requestId);
  };

  return {
    connectWithUri,
    disconnect,
    getActiveSessions,
    setModalCallbacks,
    approveProposal,
    rejectProposal,
    approveRequest,
    rejectRequest,
    service: walletConnectService,
  };
}