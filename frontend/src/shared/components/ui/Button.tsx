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

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-macos-blue text-white shadow-[0_8px_22px_rgb(0_122_255/0.24)] hover:bg-macos-blue-dark active:bg-macos-blue-dark dark:bg-macos-blue-dark dark:hover:bg-macos-blue',
  secondary:
    'bg-white/72 text-macos-text shadow-[var(--shadow-card)] ring-1 ring-black/5 hover:bg-white dark:bg-white/10 dark:text-zinc-100 dark:ring-white/10 dark:hover:bg-white/14',
  ghost:
    'bg-transparent text-gray-700 hover:bg-black/5 active:bg-black/10 dark:text-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15',
  danger:
    'bg-macos-red text-white shadow-[0_8px_22px_rgb(255_59_48/0.22)] hover:bg-red-500 active:bg-red-600',
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
          'inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-button)] font-semibold tracking-tight transition-all duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-macos-blue/55 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950',
          'disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none',
          'active:scale-[0.98]',
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
