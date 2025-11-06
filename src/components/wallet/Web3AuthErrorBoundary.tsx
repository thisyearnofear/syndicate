"use client";

import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class Web3AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Skip logging indexedDB errors as they're handled at console level
    if (
      !error.message.includes("indexedDB is not defined") &&
      !error.message.includes("ReferenceError: indexedDB is not defined")
    ) {
      console.error("Web3Auth error boundary caught error:", error);
    }
  }

  render() {
    if (this.state.hasError) {
      const isNetworkError =
        this.state.error?.message?.includes("ERR_NETWORK") ||
        this.state.error?.message?.includes("Failed to fetch") ||
        this.state.error?.message?.includes("TimeoutError");

      const isIndexedDBError =
        this.state.error?.message?.includes("indexedDB") ||
        this.state.error?.message?.includes("QuotaExceededError");

      return (
        this.props.fallback || (
          <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-center">
                <h2 className="text-xl font-bold text-red-400 mb-4">
                  {isNetworkError
                    ? "🌐 Network Issue"
                    : isIndexedDBError
                    ? "🗄️ Browser Storage Issue"
                    : "⚠️ Authentication Error"}
                </h2>

                {isNetworkError ? (
                  <div className="space-y-3">
                    <p className="text-gray-300 text-sm">
                      Unable to connect to authentication services. Please check
                      your internet connection.
                    </p>
                    <button
                      onClick={() => window.location.reload()}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Retry Connection
                    </button>
                  </div>
                ) : isIndexedDBError ? (
                  <div className="space-y-3">
                    <p className="text-gray-300 text-sm">
                      Browser storage issue detected. Try clearing your browser
                      data or use incognito mode.
                    </p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-gray-300 text-sm">
                      An authentication error occurred. You can still browse the
                      lottery without connecting.
                    </p>
                    <div className="bg-gray-700 rounded p-3 text-xs text-gray-400 text-left overflow-auto max-h-20">
                      {this.state.error?.message}
                    </div>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                      >
                        Reload Page
                      </button>
                      <button
                        onClick={() => this.setState({ hasError: false })}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                      >
                        Continue Browsing
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-600">
                  <p className="text-xs text-gray-500">
                    Syndicate - Cross-Chain Lottery Platform
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
