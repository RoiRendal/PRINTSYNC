import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from './icons';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Defaults to `secondary` — the grey control fill, which is what ERPNext uses
   * for every button that is not the one dominant action on the screen. Reach
   * for `primary` deliberately, and only when the button is genuinely the single
   * thing the user should press: a page-header "Add X", a modal's confirm, or the
   * only action on the page.
   */
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/*
  The button ladder, matched to ERPNext.

  ERPNext's rule is not "buttons are grey" — it is that a button's fill is the
  FIELD's fill. Measured on the live demo (`/app/account`), `.btn-default` and
  `.form-control` render the identical `rgb(243,243,243)` fill with the identical
  `rgb(56,56,56)` ink, an 8px radius and `border: 0px none`. That is why
  `secondary` reads `--app-surface-sub`, the same token `Input` uses: a button
  beside a field is the same object as the field.

  Dark is a BUDGET OF ONE PER SCREEN. On the same page exactly one element is
  `#171717` — `.btn-primary.primary-action`, the single dominant action. So
  `primary` is the exception and `secondary` is the default. The consequence is
  deliberate: dark is now opt-in, and `grep -rn 'variant="primary"'` is the
  complete, auditable list of dark buttons in the app.

  `secondary` carries NO ring. ERPNext's default button has `border: 0px none`,
  and the fill alone separates it from a white card at 1.18:1 — the same ratio
  `--app-state-hover` is documented at on a raised surface. One caveat that is
  written down rather than rediscovered: on a `--app-surface-sub` PARENT this
  fill measures 1.00:1, i.e. invisible in both themes. A button placed on a
  `-sub` surface must use `--app-state-hover-sub` instead. Nothing in the app
  does that today.
*/
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-app-accent text-[var(--app-accent-ink)] hover:bg-app-accent-hover active:bg-app-accent-hover dark:bg-app-accent-hover dark:hover:bg-app-accent',
  secondary:
    'bg-[var(--app-surface-sub)] text-app-ink hover:bg-[var(--app-state-hover-sub)] dark:text-zinc-100',
  ghost:
    'bg-transparent text-gray-700 hover:bg-[var(--app-state-hover)] active:bg-[var(--app-state-hover-sub)] dark:text-zinc-200',
  danger:
    'bg-app-danger text-white hover:bg-red-500 active:bg-red-600',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-6 px-2 text-xs',
  md: 'h-7 px-2 text-xs',
  lg: 'h-9 px-3 text-sm',
  icon: 'h-7 w-7 p-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
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
        className={cn(
          'inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-button)] font-semibold tracking-tight',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-border-control)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950',
          'disabled:cursor-not-allowed disabled:opacity-55',
          'active:scale-[0.98]',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {isLoading ? <LoaderCircle className="h-3.5 w-3.5" aria-hidden="true" /> : leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
