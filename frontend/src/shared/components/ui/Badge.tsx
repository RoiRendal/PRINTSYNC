import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type BadgeVariant = 'neutral' | 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'gray';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'border-[var(--app-border-hairline)] bg-[var(--app-tint-neutral)] text-gray-700 dark:text-zinc-300',
  blue: 'border-[var(--app-border-hairline)] bg-[var(--app-tint-blue)] text-macos-blue dark:text-macos-cyan',
  green: 'border-[var(--app-border-hairline)] bg-[var(--app-tint-green)] text-green-700 dark:text-green-300',
  red: 'border-[var(--app-border-hairline)] bg-[var(--app-tint-red)] text-red-700 dark:text-red-300',
  orange: 'border-[var(--app-border-hairline)] bg-[var(--app-tint-orange)] text-orange-700 dark:text-orange-300',
  purple: 'border-[var(--app-border-hairline)] bg-[var(--app-tint-purple)] text-purple-700 dark:text-purple-300',
  /* The dark text is a step lighter than the other gray text in the app: the old
     value measured 4.23:1 on this fill, under the floor for 9px type. */
  gray: 'border-[var(--app-border-hairline)] bg-[var(--app-tint-gray)] text-gray-500 dark:text-zinc-300',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[9px]',
  md: 'px-2.5 py-1 text-[10px]',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant = 'neutral', size = 'sm', ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      'inline-flex items-center rounded-[var(--radius-pill)] border font-bold uppercase tracking-[0.12em]',
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
