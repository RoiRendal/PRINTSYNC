import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/*
 * Phase 4: the button becomes a physical control.
 *
 * Depth comes from ambientcss, which derives a bevel and a cast shadow from one
 * light source (see the material layer in `index.css`). Each variant is given a
 * different *elevation* rather than a different hand-tuned drop shadow, so the
 * hierarchy is a single physical scale instead of four unrelated values:
 *
 *   primary / danger  elevation 1 — a raised key; the most prominent thing in a
 *                                   control row
 *   secondary         elevation 0 — flush with the surface it sits on, a panel
 *                                   button rather than a key
 *   ghost             no material — it is a label you can press, not a control
 *
 * Three of the old classes are worth calling out, because adding `.ambient`
 * does not merely restyle them — it breaks two of them outright:
 *
 *   - `shadow-[0_8px_22px_rgb(0_122_255/0.24)]` on primary, and its red twin on
 *     danger, are gone. They were a *blue* glow behind a button whose
 *     background is `--color-macos-blue`, which is now grey (`#555558`) — the
 *     glow had been the wrong colour for two phases. `.ambient` is unlayered
 *     and owns `box-shadow`, so they were also already inert the moment the
 *     material landed.
 *
 *   - `ring-1 ring-[var(--app-hairline)]` on secondary is now a real `border`.
 *     A Tailwind ring *is* a box-shadow, so `.ambient` would have swallowed it
 *     and the button would have lost its outline entirely.
 *
 *   - `active:scale-[0.98]` is replaced by `.mat-press`, which sinks the surface
 *     inward instead of shrinking it. Nothing moves.
 */
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'ambient amb-elevation-1 mat-press bg-macos-blue text-white hover:bg-macos-blue-dark active:bg-macos-blue-dark dark:bg-macos-blue-dark dark:hover:bg-macos-blue',
  secondary:
    'ambient amb-elevation-0 mat-press border border-[var(--app-hairline)] bg-[var(--app-surface-raised)] text-macos-text hover:bg-[var(--app-chrome)] dark:text-zinc-100',
  ghost:
    'bg-transparent text-gray-700 hover:bg-black/5 active:bg-black/10 dark:text-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15',
  danger: 'ambient amb-elevation-1 mat-press bg-macos-red text-white hover:bg-red-500 active:bg-red-600',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[11px]',
  md: 'h-9 px-4 text-xs',
  lg: 'h-11 px-5 text-sm',
  icon: 'h-9 w-9 p-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        /*
         * Announced so a loading button is distinguishable from a merely
         * disabled one. The label is deliberately kept (below) rather than
         * swapped for the spinner alone: `prefers-reduced-motion` stops the
         * spin, and the text is then the only signal that work is in flight.
         */
        aria-busy={isLoading}
        className={cn(
          'inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-button)] font-semibold tracking-tight',
          /*
           * `transition-colors`, not `transition-all`. A key does not ease its
           * way down, so the pressed shadow appears the instant the button is
           * held; colour still eases, so hover does not snap.
           */
          'transition-colors duration-200 ease-out',
          /*
           * `.mat-focus` draws an `outline` rather than a ring. A ring is a
           * box-shadow, so `.ambient` would swallow it — and even where it did
           * not, a ring is drawn inside the border box, which is exactly what a
           * bevel hides. See the material layer in `index.css`.
           */
          'mat-focus',
          /*
           * `disabled:shadow-none` used to sit here and is deliberately gone:
           * it was a box-shadow utility, so it never applied once the button
           * carried `.ambient`. `disabled:opacity-55` fades the bevel along
           * with everything else, which is the honest way to show a key that
           * cannot be pressed.
           */
          'disabled:cursor-not-allowed disabled:opacity-55',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {isLoading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
