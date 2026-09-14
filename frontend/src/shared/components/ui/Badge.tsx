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
  neutral: 'border-gray-200 bg-gray-100/80 text-gray-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-300',
  blue: 'border-macos-blue/20 bg-macos-blue/12 text-macos-blue dark:border-macos-blue-dark/30 dark:bg-macos-blue-dark/18 dark:text-macos-cyan',
  green: 'border-macos-green/20 bg-macos-green/12 text-green-700 dark:border-macos-green/25 dark:bg-macos-green/16 dark:text-green-300',
  red: 'border-macos-red/20 bg-macos-red/12 text-red-700 dark:border-macos-red/25 dark:bg-macos-red/16 dark:text-red-300',
  orange: 'border-macos-orange/25 bg-macos-orange/14 text-orange-700 dark:border-macos-orange/25 dark:bg-macos-orange/16 dark:text-orange-300',
  purple: 'border-macos-purple/25 bg-macos-purple/12 text-purple-700 dark:border-macos-purple/25 dark:bg-macos-purple/16 dark:text-purple-300',
  gray: 'border-gray-200 bg-white/70 text-gray-500 dark:border-white/10 dark:bg-white/8 dark:text-zinc-400',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[9px]',
  md: 'px-2.5 py-1 text-[10px]',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant = 'neutral', size = 'sm', ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      'inline-flex items-center rounded-[var(--radius-pill)] border font-bold uppercase tracking-[0.12em] backdrop-blur-md',
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
