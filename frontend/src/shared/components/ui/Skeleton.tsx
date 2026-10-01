import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/**
 * A block standing in for content that has not arrived yet.
 *
 * The geometry is the caller's: this draws a rectangle of whatever size the
 * placeholder needs, so a page skeleton is a composition of these rather than a
 * new component per shape. ERPNext does the same — its `frappe.ui.skeleton`
 * helper takes `width`/`height` and emits one `.es-skeleton` div
 * (`frappe/public/js/frappe/ui/components/skeleton.js`).
 *
 * Two deliberate differences from the reference:
 *
 * - **The fill is a token, not a fixed grey.** ERPNext paints `--skeleton-bg`,
 *   which resolves from its own surface ladder and follows dark mode for free.
 *   Ours is `--app-skeleton`, declared in `:root` and `.dark` together, so the
 *   block inverts with the theme and the measured contrast is written down
 *   beside the values.
 * - **There is no pulse.** ERPNext gives its skeleton a two-second opacity
 *   cycle. This app is deliberately motion-free — `check-flat-ui.mjs` fails the
 *   build on any keyframe rule, duration utility or motion library, and that
 *   gate is load-bearing, not incidental. It costs nothing here: ERPNext's own
 *   stylesheet concedes that "a still gray block reads fine without the pulse".
 *
 * `aria-hidden` because a placeholder is decoration. The region being loaded
 * carries `aria-busy` instead, so a screen reader is told to wait rather than
 * read a shape.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('rounded-[var(--radius-card)] bg-[var(--app-skeleton)]', className)}
      {...props}
    />
  );
}
