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
 * Phase 4: the card becomes a plate resting on the page.
 *
 * `glass` was already de-glassed in Phase 3; what it gains now is the same
 * material as `solid`, so the two stay collapsed into one definition rather
 * than two that happen to match. `GlassCard` remains as the public name — 11
 * call sites import it — but it is a synonym for a raised surface.
 *
 * `elevated` stays a genuinely different thing: 14 call sites use it to mean
 * "floating above the page", which is now expressed as a higher elevation in
 * the light engine instead of a second hand-written shadow.
 *
 * The material classes do the work and the tokens keep the colour:
 *
 *   ambient          — bevel plus cast shadow, from the one light source
 *   amb-elevation-0  — resting on the surface (the plate idiom)
 *   amb-elevation-2  — clearly lifted
 *
 * `shadow-[var(--shadow-card)]` and `shadow-[var(--shadow-elevated)]` are gone
 * from this file because `.ambient` is unlayered and owns `box-shadow`, so
 * leaving them would have been dead weight that still read as if it were doing
 * something. Both tokens keep other consumers.
 *
 * The base `transition-colors` is kept deliberately, against the plan. Several
 * call sites are clickable and pass their own `hover:` colours, and dropping
 * the transition here would silently make those snap.
 */
const raisedSurface =
  'ambient amb-elevation-0 border border-[var(--app-hairline)] bg-[var(--app-surface-raised)]';

const variantClasses: Record<CardVariant, string> = {
  solid: raisedSurface,
  glass: raisedSurface,
  elevated:
    'ambient amb-elevation-2 border border-[var(--app-hairline)] bg-[var(--app-surface-raised)]',
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
    <p ref={ref} className={cn('text-xs leading-relaxed text-macos-text-muted', className)} {...props} />
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
