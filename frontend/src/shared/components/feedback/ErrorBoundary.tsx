import React from 'react';
import { AlertTriangle, RotateCw } from '../ui/icons';
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
            {/* The glyph is bare and carries no hue — the 56px ringed red tile
                around it was a box around an icon, not structure, and the
                triangle's shape already says what the colour used to repeat. */}
            <span className="block text-app-text-muted dark:text-zinc-400">
              <AlertTriangle className="mx-auto h-7 w-7" aria-hidden="true" />
            </span>
            <div className="mt-5 space-y-2">
              {/* No hue. The words say the severity; red only repeated them, and
                  the label now takes the card's default ink like any other text. */}
              <p className="text-2xs font-bold">Application alert</p>
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
                onClick={() => window.location.reload()}
                leftIcon={<RotateCw className="h-3.5 w-3.5" aria-hidden="true" />}
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
