import { forwardRef } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const fieldBaseClasses =
  'w-full rounded-[var(--radius-button)] !border-transparent bg-[var(--app-surface-sub)] px-2 text-sm text-macos-text placeholder:text-[var(--app-text-muted)] focus:!border-transparent focus:!bg-[var(--app-state-hover-sub)] dark:focus:!bg-[var(--app-state-hover-sub)] focus:outline-none !ring-0 dark:text-zinc-100 dark:placeholder:text-zinc-500';

/*
  These are ERPNext's form fields, not macOS ones.

  ERPNext's `.form-control` is a FILLED control: `border: none`, a soft grey
  background, an 8px radius and no outline at rest. Measured on the live demo
  (`/app/sales-order`), an input renders as background `rgb(243,243,243)` with
  `border: 0px none` — the outline this component used to draw is not part of
  the reference at all. So the border is forced transparent rather than tinted,
  and the fill carries the field.

  Focus darkens the fill by one step instead of drawing a frame. ERPNext's own
  stylesheet does add a 2px grey ring on focus, but that is the exact frame that
  was removed from the table search bars by request, and two different focus
  behaviours in one app is worse than one deliberate deviation. The fill step is
  the same one the search bars use, so every field in PrintSync now behaves
  identically.

  `!` on the ring and the border is load-bearing, not decoration. `tailwind-merge`
  does NOT treat `!` as part of a class key, so a variant-vs-base pair such as
  `ring-4` (elsewhere) against `focus:!ring-0` (here) can survive BOTH and leave
  the winner to stylesheet order. An unconditional `!ring-0` removes the variable
  entirely. Ring utilities are permitted by check-flat-ui: a ring is pure spread,
  i.e. a focus indicator, not an elevation.

  R5 was a colour, border and shape match only — height, font size and padding
  were deliberately left at PrintSync's 36px / 14px. R9 then tightened them to
  ERPNext: inputs/selects default to h-7 (28px) with 8px side padding, textareas
  and buttons shrank to match. Font size is the one thing still unchanged. The
  `!` on ring/border remains load-bearing (see above), not decoration.
*/

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  fieldSize?: 'sm' | 'md' | 'lg';
}

const inputSizeClasses: Record<NonNullable<InputProps['fieldSize']>, string> = {
  sm: 'h-6 text-xs',
  md: 'h-7 text-sm',
  lg: 'h-9 text-base',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, fieldSize = 'md', ...props }, ref) => (
  <input ref={ref} className={cn(fieldBaseClasses, inputSizeClasses[fieldSize], className)} {...props} />
));

Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  fieldSize?: 'sm' | 'md' | 'lg';
}

const textareaSizeClasses: Record<NonNullable<TextareaProps['fieldSize']>, string> = {
  sm: 'min-h-16 py-1.5 text-xs',
  md: 'min-h-20 py-2 text-sm',
  lg: 'min-h-28 py-2.5 text-base',
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
