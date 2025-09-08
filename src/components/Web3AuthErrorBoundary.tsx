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
    // Log Web3Auth-specific errors
    if (
      error.message.includes("indexedDB is not defined") ||
      error.message.includes("ReferenceError: indexedDB is not defined")
    ) {
      console.error("Web3Auth indexedDB error detected:", error);
      console.error(
        "This error occurs when Web3Auth tries to access indexedDB during SSR"
      );
    }

    // Log unhandled promise rejections related to Web3Auth
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason?.message?.includes("indexedDB is not defined") ||
        event.reason?.message?.includes(
          "ReferenceError: indexedDB is not defined"
        )
      ) {
        console.error("Web3Auth indexedDB unhandled rejection:", event.reason);
        console.error(
          "This error occurs when Web3Auth tries to access indexedDB during SSR"
        );
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Cleanup listener after logging
    setTimeout(() => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );
    }, 1000);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
            <h3 className="text-red-200 font-semibold">Web3Auth Error</h3>
            <p className="text-red-200 text-sm mt-2">
              There was an issue loading Web3Auth. Please refresh the page.
            </p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
