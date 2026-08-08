/**
 * PURCHASE ERROR BOUNDARY
 *
 * Lightweight error boundary for purchase flow sub-components.
 * Catches render errors in PurchaseProgress and PurchaseReceipt
 * and shows a recovery UI instead of white-screening the modal.
 */

"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/shared/components/ui/Button";
import { AlertCircle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Called when an error is caught. */
  onError?: (error: Error) => void;
  /** Called when user clicks "Go Back". */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class PurchaseErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
     
    console.error('[PurchaseErrorBoundary]', error, info.componentStack);
    this.props.onError?.(error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center space-y-4" role="alert">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Something went wrong</h3>
            <p className="text-sm text-gray-400">
              An unexpected error occurred while displaying this step. Your funds are safe.
            </p>
            {this.state.error && (
              <p className="text-xs text-red-300/70 mt-2 font-mono break-all max-w-sm mx-auto">
                {this.state.error.message.slice(0, 150)}
              </p>
            )}
          </div>
          <div className="flex gap-3 justify-center">
            <Button
              variant="default"
              size="sm"
              className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300"
              onClick={this.handleReset}
            >
              <RotateCcw className="w-3 h-3 mr-1.5" />
              Go Back
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
