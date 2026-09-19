import { forwardRef } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const fieldBaseClasses =
  'w-full rounded-[var(--radius-button)] border border-[var(--app-border-control)] bg-[var(--app-surface-raised)] px-3 text-sm text-macos-text shadow-inner shadow-black/[0.02] transition-all duration-200 ease-out placeholder:text-macos-text-muted/70 focus:border-macos-blue/55 focus:bg-white focus:outline-none focus:ring-4 focus:ring-macos-blue/15 dark:border-white/10 dark:bg-white/10 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:bg-white/12';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  fieldSize?: 'sm' | 'md' | 'lg';
}

const inputSizeClasses: Record<NonNullable<InputProps['fieldSize']>, string> = {
  sm: 'h-8 text-xs',
  md: 'h-9 text-sm',
  lg: 'h-11 text-base',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, fieldSize = 'md', ...props }, ref) => (
  <input ref={ref} className={cn(fieldBaseClasses, inputSizeClasses[fieldSize], className)} {...props} />
));

Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  fieldSize?: 'sm' | 'md' | 'lg';
}

const textareaSizeClasses: Record<NonNullable<TextareaProps['fieldSize']>, string> = {
  sm: 'min-h-20 py-2 text-xs',
  md: 'min-h-28 py-2.5 text-sm',
  lg: 'min-h-36 py-3 text-base',
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, fieldSize = 'md', ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBaseClasses, 'resize-y', textareaSizeClasses[fieldSize], className)} {...props} />
));

Textarea.displayName = 'Textarea';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  fieldSize?: 'sm' | 'md' | 'lg';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, fieldSize = 'md', ...props }, ref) => (
  <select ref={ref} className={cn(fieldBaseClasses, inputSizeClasses[fieldSize], 'cursor-pointer', className)} {...props} />
));

Select.displayName = 'Select';
