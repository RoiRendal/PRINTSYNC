import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import type { BadgeVariant } from './Badge';

/**
 * Maps the app's status tone to the label's text colour. It shares the
 * vocabulary of `Badge` / `getStatusBadgeVariant` on purpose: a status must have
 * exactly one colour mapping across the app, whether it is drawn as a pill, a
 * dot or plain text, so the two can never drift apart.
 *
 * Red is the app's inline alert red (`text-macos-red`) rather than Badge's
 * darker `text-red-700`, so a row cannot show two different reds side by side —
 * the Orders table places this label next to the overdue date, which is that
 * same red.
 */
const toneClasses: Record<BadgeVariant, string> = {
  neutral: 'text-macos-text-muted dark:text-zinc-400',
  gray: 'text-macos-text-muted dark:text-zinc-400',
  blue: 'text-macos-blue dark:text-macos-cyan',
  green: 'text-green-700 dark:text-green-300',
  red: 'text-macos-red dark:text-red-300',
  orange: 'text-orange-700 dark:text-orange-300',
  purple: 'text-purple-700 dark:text-purple-300',
};

export interface StatusLabelProps extends HTMLAttributes<HTMLSpanElement> {
  /** Colour of the label. Feed `getStatusBadgeVariant(status)` to keep one mapping. */
  tone?: BadgeVariant;
}

/**
 * A status rendered as a coloured label — the in-table replacement for the bold
 * `Badge` pill.
 *
 * It sets no font weight or size of its own: the label inherits the cell's type,
 * so a row keeps one font, one size and one weight, and the only signal is the
 * text colour. An earlier version prefixed a small indicator dot; that was
 * removed on review, so colour alone now carries the tone.
 */
export function StatusLabel({ tone = 'neutral', className, children, ...props }: StatusLabelProps) {
  return (
    <span className={cn(toneClasses[tone], className)} {...props}>
      {children}
    </span>
  );
}
