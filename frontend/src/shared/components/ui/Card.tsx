import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/**
 * Two names, and only because collapsing the second one is a visual change.
 *
 * `solid` and `elevated` were byte-identical class strings, so `solid` is gone —
 * it had no call sites anywhere, which makes promoting `elevated` to the default
 * a provable no-op rather than a hopeful one.
 *
 * `raised` is deliberately left alone even though it reaches the same appearance.
 * It is **not** the same declaration: `.surface-panel` is a component-layer rule
 * while the others are utility-layer ones, so a caller passing an overriding
 * class (a `bg-*`, say) resolves differently between them. Merging them would be
 * a visual change that has to be measured rather than reasoned about, and it
 * touches 22 call sites.
 */
export type CardVariant = 'raised' | 'elevated';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
}

const variantClasses: Record<CardVariant, string> = {
  raised: 'surface-panel',
  elevated:
    'border border-[var(--app-border-hairline)] bg-[var(--app-surface-raised)]',
};

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5 lg:p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'elevated', padding = 'md', ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-[var(--radius-card)]', variantClasses[variant], paddingClasses[padding], className)}
      {...props}
    />
  ),
);

Card.displayName = 'Card';

export const SurfaceCard = forwardRef<HTMLDivElement, Omit<CardProps, 'variant'>>(
  ({ className, ...props }, ref) => <Card ref={ref} variant="raised" className={className} {...props} />,
);

SurfaceCard.displayName = 'SurfaceCard';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('mb-4 flex flex-col gap-1.5', className)} {...props} />,
);

CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-sm font-bold tracking-tight text-macos-text dark:text-zinc-100', className)} {...props} />
  ),
);

CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-xs leading-relaxed text-macos-text-muted dark:text-zinc-400', className)} {...props} />
  ),
);

CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('min-w-0', className)} {...props} />,
);

CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mt-4 flex items-center justify-end gap-2 border-t border-[var(--app-border-hairline)] pt-4', className)} {...props} />
  ),
);

CardFooter.displayName = 'CardFooter';
