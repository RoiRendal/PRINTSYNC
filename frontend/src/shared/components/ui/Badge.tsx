import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type BadgeVariant = 'neutral' | 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'gray';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

/*
 * The green variant carries `text-green-800` where every other variant carries
 * `-700`. The asymmetry is deliberate (Phase 11).
 *
 * All of these were tuned against a white card, where `text-green-700` measures
 * 4.95:1 — a comfortable pass. But a badge's background is not white: the tint
 * IS the background, and green's is the lightest of the set, so the same pair
 * measures **4.47:1** on a card and **3.73:1** on the darker toolbar surface the
 * connection chip sits on. Both are under the 4.5:1 floor for text, and
 * `getStatusBadgeVariant` renders these at 9px.
 *
 * Green is the only variant that lands there — `red-700` on `bg-macos-red/12` and
 * `orange-700` on `bg-macos-orange/14` both still clear 4.5:1, which the Phase 10
 * audit verified by measuring every one of them. Deepening the text rather than
 * weakening the tint leaves the badge's appearance and geometry untouched.
 */
const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'border-gray-200 bg-gray-100/80 text-gray-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-300',
  blue: 'border-macos-blue/20 bg-macos-blue/12 text-macos-blue dark:border-macos-blue-dark/30 dark:bg-macos-blue-dark/18 dark:text-macos-cyan',
  green: 'border-macos-green/20 bg-macos-green/12 text-green-800 dark:border-macos-green/25 dark:bg-macos-green/16 dark:text-green-300',
  red: 'border-macos-red/20 bg-macos-red/12 text-red-700 dark:border-macos-red/25 dark:bg-macos-red/16 dark:text-red-300',
  orange: 'border-macos-orange/25 bg-macos-orange/14 text-orange-700 dark:border-macos-orange/25 dark:bg-macos-orange/16 dark:text-orange-300',
  purple: 'border-macos-purple/25 bg-macos-purple/12 text-purple-700 dark:border-macos-purple/25 dark:bg-macos-purple/16 dark:text-purple-300',
  gray: 'border-[var(--app-hairline)] bg-[var(--app-surface-raised)] text-gray-500 dark:text-zinc-400',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[9px]',
  md: 'px-2.5 py-1 text-[10px]',
};

/*
 * Phase 4: the lightest possible material.
 *
 * A badge is about 17px tall, so it takes `amb-elevation-0` and nothing more —
 * the shallowest setting on the ladder, which at this size reads as a small
 * chip sitting on the surface rather than as a floating object. Anything higher
 * would be a shadow larger than the thing casting it.
 *
 * There is no contrast risk here. `.ambient` sets `box-shadow` and nothing
 * else, so the tinted background and the text on it are pixel-identical to
 * before; only a soft edge appears around the chip. That matters because
 * `getStatusBadgeVariant` output is read at 9px in table rows.
 *
 * Badges appear both inside the flat data tables and on dashboard and analytics
 * cards. Embossing them does not make a table non-flat — the table's own
 * surface stays plain — but this is the one decision in this phase worth a
 * second look on screen, so it is flagged rather than assumed.
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant = 'neutral', size = 'sm', ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      'ambient amb-elevation-0 inline-flex items-center rounded-[var(--radius-pill)] border font-bold uppercase tracking-[0.12em]',
      variantClasses[variant],
      sizeClasses[size],
      className,
    )}
    {...props}
  />
));

Badge.displayName = 'Badge';

export function getStatusBadgeVariant(status: string): BadgeVariant {
  const normalized = status.toLowerCase();
  if (normalized.includes('ready') || normalized.includes('completed') || normalized.includes('delivered') || normalized.includes('online')) return 'green';
  if (normalized.includes('pending') || normalized.includes('warning') || normalized.includes('critical')) return 'orange';
  if (normalized.includes('design') || normalized.includes('custom')) return 'purple';
  if (normalized.includes('production') || normalized.includes('active')) return 'blue';
  if (normalized.includes('error') || normalized.includes('delete') || normalized.includes('failed')) return 'red';
  return 'neutral';
}
