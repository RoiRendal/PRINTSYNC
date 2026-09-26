import type { LucideIcon } from 'lucide-react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/cn';

export type InlineAlertTone = 'error' | 'warning';

/**
 * The two tones this app needs, each with the icon it falls back to.
 *
 * Deliberately only two. An informational tone was considered and left out: every
 * call site so far is reporting that something the user asked for did not happen,
 * and a component that can also say "all good" invites the message that matters
 * to be rendered in the reassuring style by mistake.
 */
const TONE_STYLES: Record<InlineAlertTone, { panel: string; Icon: LucideIcon }> = {
  error: {
    panel:
      'border-[var(--app-border-hairline)] bg-[var(--app-tint-red)] text-red-700 dark:text-red-300',
    Icon: AlertCircle,
  },
  warning: {
    panel:
      'border-[var(--app-border-hairline)] bg-[var(--app-tint-amber)] text-amber-700 dark:text-amber-300',
    Icon: AlertTriangle,
  },
};

interface InlineAlertProps {
  /** The sentence to show. Say what happened, not that something went wrong. */
  message: string;
  tone?: InlineAlertTone;
  /**
   * Optional bold heading above the message. Use it when the message alone would
   * be ambiguous about the *state* the user is now in — "Nothing was charged" is
   * the canonical example.
   */
  title?: string;
  /** Overrides the tone's default icon. */
  icon?: LucideIcon;
  onDismiss?: () => void;
  className?: string;
}

/**
 * The banner used to report a failed action inside the surface that triggered it.
 *
 * Extracted because the same markup had been written out three times — twice in
 * the checkout modal and once on the orders page — and the Tier 5 work needed it
 * in three more places. A fourth copy would have been the point at which the
 * three drifted apart in tone or accessibility, so this is the one
 * implementation instead.
 *
 * Renders `role="alert"` so the message is announced when it appears. The
 * page-level `ErrorState` is a different thing: that one replaces a whole view
 * that could not load, while this one sits inside a dialog or form that is still
 * usable.
 */
export function InlineAlert({
  message,
  tone = 'error',
  title,
  icon,
  onDismiss,
  className,
}: InlineAlertProps) {
  const { panel, Icon: ToneIcon } = TONE_STYLES[tone];
  const Icon = icon ?? ToneIcon;

  return (
    <div
      role="alert"
      className={cn(
        'rounded-[var(--radius-card)] border px-3 py-2 text-xs font-semibold leading-relaxed',
        panel,
        onDismiss && 'flex items-start justify-between gap-3',
        className,
      )}
    >
      <div className={cn(title && 'space-y-1.5')}>
        {title && (
          <div className="flex items-center gap-1.5 font-bold">
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{title}</span>
          </div>
        )}
        <p className={cn(title && 'font-normal')}>{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 cursor-pointer text-2xs font-bold underline decoration-dotted underline-offset-2"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
