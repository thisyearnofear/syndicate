"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Copy, Check } from "lucide-react";
import { useWalletConnect } from "@/services/walletConnectService";

interface WalletConnectSession {
  topic: string;
  peer: {
    metadata: {
      name: string;
      description: string;
      url: string;
      icons: string[];
    };
  };
  expiry: number;
}

export default function WalletConnectSessions() {
  const [sessions, setSessions] = useState<WalletConnectSession[]>([]);
  const [copiedTopic, setCopiedTopic] = useState<string | null>(null);
  const { getActiveSessions, disconnect } = useWalletConnect();

  useEffect(() => {
    // Load active sessions
    const loadSessions = () => {
      const activeSessions = getActiveSessions();
      setSessions(Object.values(activeSessions));
    };

    loadSessions();

    // Update sessions periodically
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [getActiveSessions]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTopic(text);
      setTimeout(() => setCopiedTopic(null), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const disconnectSession = async (topic: string) => {
    try {
      await disconnect(topic);
      // Refresh sessions after disconnect
      const activeSessions = getActiveSessions();
      setSessions(Object.values(activeSessions));
    } catch (error) {
      console.error("Failed to disconnect session:", error);
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">No active WalletConnect sessions</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Active Connections</h3>
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.topic}
            className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {session.peer.metadata.icons[0] ? (
                  <img
                    src={session.peer.metadata.icons[0]}
                    alt={session.peer.metadata.name}
                    className="w-10 h-10 rounded-lg object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
                    <span className="text-white font-medium">
                      {session.peer.metadata.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <h4 className="font-medium text-white">
                    {session.peer.metadata.name}
                  </h4>
                  <p className="text-sm text-gray-400 mt-1">
                    {session.peer.metadata.url}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                      Topic: {session.topic.substring(0, 8)}...
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(session.topic)}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                    >
                      {copiedTopic === session.topic ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => disconnectSession(session.topic)}
                className="text-gray-400 hover:text-red-400 h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}