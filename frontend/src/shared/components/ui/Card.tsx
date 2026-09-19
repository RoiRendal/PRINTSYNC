import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type CardVariant = 'solid' | 'glass' | 'elevated';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
}

/*
 * Phase 3: `glass` is no longer glass.
 *
 * The variant name and the `GlassCard` export are kept — 9 call sites use
 * `variant="glass"` and 11 import `GlassCard`, and renaming the public surface
 * is a Phase 4 job. What matters here is that nothing frosts and nothing is
 * translucent.
 *
 * `solid` and `glass` deliberately resolve to the same treatment for now: they
 * were always the same idea spelled two ways ("a card on a raised surface"),
 * and collapsing them removes a choice that had no visual meaning. `elevated`
 * stays distinct because 14 call sites use it to mean "floating above the
 * page", which is a real difference in depth.
 *
 * Every variant is token-driven, so none of them needs a `dark:` override.
 */
const variantClasses: Record<CardVariant, string> = {
  solid:
    'border border-[var(--app-hairline)] bg-[var(--app-surface-raised)] shadow-[var(--shadow-card)]',
  glass: 'surface-panel',
  elevated:
    'border border-[var(--app-hairline)] bg-[var(--app-surface-raised)] shadow-[var(--shadow-elevated)]',
};

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5 lg:p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'solid', padding = 'md', ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-[var(--radius-card)] transition-colors duration-200', variantClasses[variant], paddingClasses[padding], className)}
      {...props}
    />
  ),
);

Card.displayName = 'Card';

export const GlassCard = forwardRef<HTMLDivElement, Omit<CardProps, 'variant'>>(
  ({ className, ...props }, ref) => <Card ref={ref} variant="glass" className={className} {...props} />,
);

GlassCard.displayName = 'GlassCard';

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
    <div ref={ref} className={cn('mt-4 flex items-center justify-end gap-2 border-t border-black/5 pt-4 dark:border-white/10', className)} {...props} />
  ),
);

CardFooter.displayName = 'CardFooter';
