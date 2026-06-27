'use client';
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './button';

interface State { hasError: boolean; error?: Error; }

/** Class error boundary — catches render errors and offers recovery. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  reset = () => this.setState({ hasError: false, error: undefined });
  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <h3 className="font-display font-semibold">Something broke on this screen</h3>
            <p className="mt-1 text-sm text-muted-foreground">{this.state.error?.message ?? 'An unexpected error occurred.'}</p>
          </div>
          <Button variant="outline" onClick={this.reset}>Try again</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
