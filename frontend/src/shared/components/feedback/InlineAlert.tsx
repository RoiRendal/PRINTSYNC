import { cn } from '../../lib/cn';

export type InlineAlertTone = 'error' | 'warning';

/**
 * The two tones this app needs, each with the dot that carries it.
 *
 * Deliberately only two. An informational tone was considered and left out: every
 * call site so far is reporting that something the user asked for did not happen,
 * and a component that can also say "all good" invites the message that matters
 * to be rendered in the reassuring style by mistake.
 *
 * **The dot is the only thing in a failure message with a hue.** The message used
 * to be painted red (or amber) end to end, behind a matching tinted panel, with
 * an alert icon in front of it — three cues saying one thing. The text colour and
 * the fill were the loudest part of the screen and both are unreadable to a
 * colour-blind user, so they were also the least reliable. A 6px dot carries the
 * severity, the words carry the meaning, and everything else sits in the same ink
 * as the copy around it.
 */
const TONE_DOT: Record<InlineAlertTone, string> = {
  error: 'bg-app-danger',
  warning: 'bg-app-warning',
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
  /**
   * `panel` draws the hairline box — use it where the message stands on its own.
   * `inline` is a bare line — use it directly under the field it is about.
   */
  variant?: 'panel' | 'inline';
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
 * implementation instead. R22 folded the last hand-rolled copies in: six one-off
 * red boxes in Settings, Inventory, Designs, Orders and POS that each spelled the
 * same idea slightly differently, and four bare red `<p>` errors.
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
  variant = 'panel',
  onDismiss,
  className,
}: InlineAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 text-xs leading-relaxed',
        variant === 'panel' && 'rounded-[var(--radius-card)] border px-3 py-2',
        className,
      )}
    >
      <span
        className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[tone])}
        aria-hidden="true"
      />
      <div className={cn('min-w-0 flex-1', title && 'space-y-1')}>
        {title && <p className="font-bold text-app-ink dark:text-zinc-100">{title}</p>}
        <p className="font-medium text-app-text-muted dark:text-zinc-400">{message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 cursor-pointer text-2xs font-bold text-app-text-muted underline decoration-dotted underline-offset-2 hover:text-app-ink dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
