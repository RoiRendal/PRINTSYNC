import { forwardRef } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/*
 * Phase 4: a field is a well, not a box with a shadow.
 *
 * `.amb-groove` is the engine's recessed idiom — a dark inset from the light
 * side, a light inset from the shadow side, both scaled by the light source and
 * by `--amb-thickness`. `.mat-well` supplies the token colour, which the groove
 * would otherwise take from its own near-white albedo and render as a light
 * blue-grey on the dark theme. The two are always used together; the material
 * layer in `index.css` explains why the pair is required rather than optional.
 *
 * Because `.amb-groove` is unlayered and owns `background-color`, a Tailwind
 * background on a field is inert. That is why the old
 * `bg-[var(--app-surface)]` is gone — `mat-well` sets exactly that value — and
 * why focus no longer tries to fill the well in with
 * `focus:bg-[var(--app-surface-raised)]`. A well that fills in when you click
 * it is not a well.
 *
 * Three further classes were removed rather than restyled, because the material
 * had already made them dead:
 *
 *   - `shadow-inner shadow-black/[0.02]` — a box-shadow, which `.amb-groove`
 *     replaces outright with a real two-sided inset.
 *   - `focus:ring-4 focus:ring-macos-blue/15` — also a box-shadow, so it had
 *     stopped applying the moment the well landed.
 *   - `focus:outline-none` — it would have cancelled the `.mat-focus` outline
 *     that now carries the focus state.
 *
 * `.mat-focus` draws that indicator as an `outline`, a separate channel from
 * `box-shadow`, so it survives both the groove and the bevel.
 */
const fieldBaseClasses =
  'amb-groove mat-well mat-focus w-full rounded-[var(--radius-button)] border border-[var(--app-hairline)] px-3 text-sm text-macos-text transition-colors duration-200 ease-out placeholder:text-macos-text-muted/70 focus:border-macos-blue/55 dark:text-zinc-100 dark:placeholder:text-zinc-400';

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
