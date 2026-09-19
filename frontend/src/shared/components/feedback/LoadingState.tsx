import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

/**
 * The app's only "something is happening" affordance.
 *
 * Accessibility note — this is deliberate, not incidental. The
 * `prefers-reduced-motion` block in `index.css` sets every animation duration to
 * 0.01ms, which stops `animate-spin` dead. For those users the rotating icon
 * conveys nothing, so the visible `label` is the actual loading signal, and
 * `role="status"` announces it. **Do not make the label decorative or hide it
 * behind an icon-only variant** — that would leave reduced-motion users with no
 * indication that the app is working.
 *
 * Every call site passes a specific label ("Loading orders", "Loading audit
 * logs", …) rather than the default, so the announcement is meaningful.
 */
export function LoadingState({ label = 'Loading', className = '' }: LoadingStateProps) {
  return (
    <div
      role="status"
      className={cn('flex min-h-24 flex-col items-center justify-center gap-3 text-macos-text-muted', className)}
    >
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--app-hairline)] bg-[var(--app-surface-raised)] shadow-[var(--shadow-card)]">
        <LoaderCircle className="h-5 w-5 animate-spin text-macos-blue dark:text-macos-cyan" aria-hidden="true" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-[0.24em]">{label}</span>
    </div>
  );
}
