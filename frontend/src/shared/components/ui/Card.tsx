import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/**
 * `raised` is the single Card variant — and the default.
 *
 * It maps to `.surface-panel` (`index.css`), declared inside `@layer utilities`
 * as `border: 1px solid var(--app-border-hairline)` with no background. The old
 * `elevated` variant compiled to the same hairline border (the `border
 * border-[var(--app-border-hairline)]` utilities) and, being utility-layer too,
 * rendered identically. Neither variant declares a background, so a caller-passed
 * `bg-*` resolves the same for both. `elevated` was therefore collapsed into
 * `raised`: no call site changes appearance. `solid` was removed earlier — it had
 * no call sites anywhere.
 */
export type CardVariant = 'raised';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
}

const variantClasses: Record<CardVariant, string> = {
  raised: 'surface-panel',
};

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5 lg:p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'raised', padding = 'md', ...props }, ref) => (
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
