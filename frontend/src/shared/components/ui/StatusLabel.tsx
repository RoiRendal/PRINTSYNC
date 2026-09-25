import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import type { BadgeVariant } from './Badge';

/**
 * Maps the app's status tone to the indicator dot's fill. It shares the
 * vocabulary of `Badge` / `getStatusBadgeVariant` on purpose: a status must have
 * exactly one colour mapping across the app, whether it is drawn as a pill or as
 * a dot, so the two can never drift apart.
 */
const dotClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-macos-gray',
  gray: 'bg-macos-gray',
  blue: 'bg-macos-blue',
  green: 'bg-macos-green',
  red: 'bg-macos-red',
  orange: 'bg-macos-orange',
  purple: 'bg-macos-purple',
};

export interface StatusLabelProps extends HTMLAttributes<HTMLSpanElement> {
  /** Tone of the indicator dot. Feed `getStatusBadgeVariant(status)` to keep one mapping. */
  tone?: BadgeVariant;
}

/**
 * A status rendered as a small coloured dot plus a plain label — the ERPNext
 * "indicator" treatment, and the in-table replacement for the bold `Badge` pill.
 *
 * It sets no font weight or size of its own: the label inherits the cell's type,
 * so a row keeps one font, one size and one weight, and colour lives only in the
 * dot. That is the whole point — the information is unchanged, the visual weight
 * is not.
 */
export function StatusLabel({ tone = 'neutral', className, children, ...props }: StatusLabelProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} {...props}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClasses[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}
