import React from 'react';
import { Button, SurfaceCard } from '../ui';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('React Error Boundary caught an error:', { error: error.message, stack: error.stack, componentStack: errorInfo.componentStack });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--app-surface)] p-6 text-app-ink dark:text-zinc-100">
          <SurfaceCard className="relative w-full max-w-md p-6 text-center">
            {/*
              No glyph, and no "Application alert" eyebrow. Both were restating
              the heading below them: the triangle said "problem" and the eyebrow
              said "this is a problem", immediately above the words "Something
              went wrong". The heading is the message; nothing needs to announce
              it first.
            */}
            <div className="space-y-2">
              {/* No hue. The words say the severity; red only repeated them, and
                  the label now takes the card's default ink like any other text. */}
              <h1 className="text-xl font-bold tracking-tight text-app-ink dark:text-zinc-100">Something went wrong</h1>
              <p className="text-sm leading-relaxed text-app-text-muted dark:text-zinc-400">
                An unexpected error occurred while rendering this page. Reloading will restore a clean application state.
              </p>
            </div>
            {this.state.error && (
              <p className="mt-4 rounded-xl border border-[var(--app-border-hairline)] px-3 py-2 text-left font-mono text-xs text-app-text-muted dark:text-zinc-300">
                {this.state.error.message}
              </p>
            )}
            <div className="mt-5 flex justify-center">
              <Button
                type="button"
                variant="primary"
                onClick={() => window.location.reload()}
              >
                Reload page
              </Button>
            </div>
          </SurfaceCard>
        </div>
      );
    }

    return this.props.children;
  }
}
