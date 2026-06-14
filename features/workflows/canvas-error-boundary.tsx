"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Catches render-time errors in the React Flow canvas (e.g. bad activity JSON
 * from the API or from the user's Code tab edits). Keeps the rest of the
 * editor shell usable — toolbar, palette, properties stay live so the user
 * can recover.
 */
export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      console.error("Canvas error:", error, info);
    }
  }

  reset = () => this.setState({ error: null });

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="text-destructive size-6" />
        <div>
          <p className="text-sm font-medium">The canvas hit an error.</p>
          <p className="text-muted-foreground max-w-md text-xs">
            {this.state.error.message || "Open the Code tab to inspect the workflow JSON."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={this.reset}>
          <RefreshCw className="size-3.5" /> Retry
        </Button>
      </div>
    );
  }
}
