import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
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
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--app-surface)] p-6 text-macos-text dark:text-zinc-100">
          <SurfaceCard className="relative w-full max-w-md p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-[var(--app-border-hairline)] bg-[var(--app-tint-red)] text-macos-red dark:text-red-300">
              <AlertTriangle className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="mt-5 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-macos-red dark:text-red-300">Application alert</p>
              <h1 className="text-xl font-bold tracking-tight text-macos-text dark:text-zinc-100">Something went wrong</h1>
              <p className="text-sm leading-relaxed text-macos-text-muted dark:text-zinc-400">
                An unexpected error occurred while rendering this page. Reloading will restore a clean application state.
              </p>
            </div>
            {this.state.error && (
              <p className="mt-4 rounded-xl border border-[var(--app-border-hairline)] bg-[var(--app-surface-sub)] px-3 py-2 text-left font-mono text-[11px] text-macos-text-muted dark:text-zinc-300">
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
