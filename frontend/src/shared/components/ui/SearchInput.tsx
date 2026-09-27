import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Input } from './Input';

/*
  The one search field in the app.

  It is now almost entirely `Input`: since the shared field base became ERPNext's
  filled, frameless, fill-on-focus style, a search bar and a form field differ in
  nothing but their default placeholder. This wrapper survives for two reasons —
  it fixes the `Search...` placeholder in one place, and it gives a list a single
  named component to reach for instead of re-deriving `Input` by hand.

  There is deliberately NO magnifier icon. ERPNext's own list search carries none,
  and the placeholder already says what the field is for, so an icon would only
  repeat it.
*/

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Only set this where a bar genuinely needs to say more than "Search...". */
  placeholder?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, placeholder = 'Search...', ...props }, ref) => (
    <Input ref={ref} type="text" placeholder={placeholder} className={className} {...props} />
  ),
);

SearchInput.displayName = 'SearchInput';
