import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Input } from './Input';
import { cn } from '../../lib/cn';

/*
  The one search field in the app.

  Modelled on ERPNext's list search, which is a filled control rather than an
  outlined one: a soft grey fill with no visible border, a rounded rectangle
  (not a pill), and grey placeholder text. There is deliberately NO magnifier
  icon — ERPNext's own list search carries none, and the placeholder already
  says what the field is for, so an icon would only repeat it.

  It is a thin wrapper over `Input` so it inherits the shared focus ring
  (`--app-border-control`, 3.26:1 — the WCAG 1.4.11 floor) and the dark-mode
  text colours for free; only the resting surface, the border and the padding
  differ. Anything passed as `className` (width, max-width, layout) still wins,
  because it is appended last.

  Every table search bar uses this. If a new list is added, use it there too
  rather than reaching for `Input` with a hand-rolled `pl-9` and an icon.
*/

/*
  The field is filled, not outlined, so the border is forced transparent in both
  states. `!` is deliberate: `Input`'s base string carries
  `border-[var(--app-border-control)]` AND `focus:border-[var(--app-border-control)]`,
  and `tailwind-merge` only collapses same-variant conflicts — the focus variant
  survives the merge, which would draw a grey edge on focus that the ERPNext
  reference does not have. Important makes the resting and focus states
  unconditionally borderless instead of depending on class order.

  On focus the fill darkens by one step instead of drawing a ring. `Input`'s base
  carries `focus:ring-4 focus:ring-[var(--app-border-control)]` — measured in the
  browser as `rgb(142,142,147) 0 0 0 4px`, a 4px grey frame that reads as heavier
  than the control itself. It is cancelled with `focus:!ring-0` and replaced by
  `focus:!bg-[var(--app-state-hover-sub)]`, the token defined as "hover on a -sub
  parent" — which is exactly this control's situation, and is one step from the
  resting `--app-surface-sub` in both themes (#ececef -> #dedee3 light,
  #3a3a3c -> #48484a dark). So the click is still acknowledged, just quietly.
  Same `!` reasoning as the border: the ring lives in a focus variant.
*/
const searchFieldClasses = [
  '!border-transparent bg-[var(--app-surface-sub)]',
  /* Ring killed unconditionally, not only on focus: `twMerge` keeps BOTH
     `focus:ring-4` (base) and `focus:!ring-0` (here) because it does not treat
     the `!` as part of the key, so the winner is decided by stylesheet order.
     An unconditional `!ring-0` removes the variable entirely. Ring utilities
     are allowed by check-flat-ui: a ring is pure spread, i.e. a focus
     indicator rather than an elevation. */
  '!ring-0',
  'focus:!border-transparent',
  /* Dark focus fill is restated for the dark theme: the base carries
     `dark:focus:bg-[#454547]`, which survives the merge and would otherwise
     override the light-mode focus tint in dark mode. */
  'focus:!bg-[var(--app-state-hover-sub)] dark:focus:!bg-[var(--app-state-hover-sub)]',
].join(' ');

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Only set this where a bar genuinely needs to say more than "Search...". */
  placeholder?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, placeholder = 'Search...', ...props }, ref) => (
    <Input
      ref={ref}
      type="text"
      placeholder={placeholder}
      className={cn(searchFieldClasses, className)}
      {...props}
    />
  ),
);

SearchInput.displayName = 'SearchInput';
