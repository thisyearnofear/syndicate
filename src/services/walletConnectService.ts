/**
 * WALLETCONNECT SERVICE
 * 
 * Implements WalletConnect v2 using the new Reown WalletKit
 * Follows the official documentation for proper integration
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

  private async onSessionProposal(proposal: WalletKitTypes.SessionProposal): Promise<void> {
    try {
      console.log("Received session proposal:", proposal);
      
      // In a real implementation, you would show a UI for user approval
      // For now, we'll auto-approve if the proposal is valid
      const approvedNamespaces = buildApprovedNamespaces({
        proposal: proposal.params,
        supportedNamespaces: this.supportedNamespaces,
      });

      const session = await this.walletKit!.approveSession({
        id: proposal.id,
        namespaces: approvedNamespaces,
      });

      console.log("Session approved:", session);
      
      // Handle redirect after approval
      this.handleRedirect(session);
      
    } catch (error) {
      console.error("Failed to approve session:", error);
      
      await this.walletKit!.rejectSession({
        id: proposal.id,
        reason: getSdkError("USER_REJECTED"),
      });
    }
  }

  private async onSessionRequest(event: WalletKitTypes.SessionRequest): Promise<void> {
    const { topic, params, id } = event;
    const { request } = params;

    try {
      console.log("Received session request:", request);

      // Handle different request methods
      let result: any;
      
      switch (request.method) {
        case "personal_sign":
          result = await this.handlePersonalSign(request.params);
          break;
        case "eth_sendTransaction":
          result = await this.handleSendTransaction(request.params);
          break;
        case "eth_signTypedData":
        case "eth_signTypedData_v4":
          result = await this.handleSignTypedData(request.params);
          break;
        default:
          throw new Error(`Unsupported method: ${request.method}`);
      }

      const response = {
        id,
        result,
        jsonrpc: "2.0" as const,
      };

      await this.walletKit!.respondSessionRequest({ topic, response });
      
    } catch (error) {
      console.error("Failed to handle session request:", error);
      
      const response = {
        id,
        jsonrpc: "2.0" as const,
        error: {
          code: 5000,
          message: "User rejected request",
        },
      };

      await this.walletKit!.respondSessionRequest({ topic, response });
    }
  }

  private onSessionDelete(event: { topic: string }): void {
    console.log("Session deleted:", event.topic);
    // Handle session cleanup
  }

  // Handle different request types
  private async handlePersonalSign(params: any[]): Promise<string> {
    const [message, address] = params;
    // In a real implementation, you would use the connected wallet to sign
    // For now, we'll throw an error to indicate this needs implementation
    throw new Error("Personal sign not implemented - requires wallet integration");
  }

  private async handleSendTransaction(params: any[]): Promise<string> {
    const [transaction] = params;
    // In a real implementation, you would use the connected wallet to send transaction
    throw new Error("Send transaction not implemented - requires wallet integration");
  }

  private async handleSignTypedData(params: any[]): Promise<string> {
    const [address, typedData] = params;
    // In a real implementation, you would use the connected wallet to sign typed data
    throw new Error("Sign typed data not implemented - requires wallet integration");
  }

  private handleRedirect(session: any): void {
    // Check if this is a native app
    const isNativeApp = session.peer.metadata.redirect !== undefined;
    
    if (isNativeApp) {
      // Redirect to native app if URL is available
      if (session.peer.metadata.redirect) {
        window.location.href = session.peer.metadata.redirect;
      } else {
        // Show "Return to App" message
        console.log("Return to app manually");
      }
    } else {
      // For web dApps, redirect back to original tab
      if (window.opener) {
        window.opener.location.href = session.peer.metadata.url;
        window.close();
      }
    }
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

  return {
    connectWithUri,
    disconnect,
    getActiveSessions,
    service: walletConnectService,
  };
}