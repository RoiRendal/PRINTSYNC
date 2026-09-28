import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from './icons';
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
    'bg-app-accent text-[var(--app-accent-ink)] hover:bg-app-accent-hover active:bg-app-accent-hover dark:bg-app-accent-hover dark:hover:bg-app-accent',
  secondary:
    'bg-[var(--app-surface-sub)] text-app-ink ring-1 ring-[var(--app-border-hairline)] hover:bg-[var(--app-state-hover-sub)] dark:text-zinc-100',
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
