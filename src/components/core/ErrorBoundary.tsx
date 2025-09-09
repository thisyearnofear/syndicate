import React, { Component, ReactNode } from "react";

/**
 * ErrorBoundary
 *
 * Catches JavaScript errors anywhere in its child component tree,
 * logs those errors, and displays a fallback UI instead of the
 * component tree that crashed.
 *
 * Core Principles:
 *   - CLEAN: isolates error handling logic
 *   - DRY: reusable across the app
 *   - PERFORMANT: minimal overhead, only renders fallback on error
 */
interface Props {
  /** UI to display when an error occurs */
  fallback?: ReactNode;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    // Update state so the next render shows the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can log the error to an external service here
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="p-4 bg-red-100 text-red-800 rounded">
            <h3 className="font-bold">Something went wrong.</h3>
            <p>Please try again later.</p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
