import { forwardRef, useEffect, useRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * The "some, but not all" state — what the header box of a table shows once a
   * couple of rows are ticked.
   *
   * This is a DOM property, not an attribute: there is no `indeterminate=""` in
   * HTML, so React cannot pass it through props and it has to be assigned to the
   * node. Assistive technology reads it off the property, which is why it is
   * worth setting rather than approximating with a dash of styling.
   */
  indeterminate?: boolean;
}

/**
 * A native checkbox, drawn to ERPNext's box.
 *
 * Native on purpose: it keeps the browser's own keyboard handling, form
 * semantics and screen-reader role. A styled `div` would have to rebuild all
 * three, and the tables it is used in are driven by keyboard as much as mouse.
 * What changes here is only the PAINT — `appearance: none` plus the geometry and
 * glyphs in `.app-checkbox`, which is ERPNext's own approach: 14px, 4px radius,
 * a 1px control-edge outline when empty, and a solid accent fill with a centred
 * tick at 57% when set.
 *
 * `indeterminate` needs the CSS as much as the DOM property. It is what the
 * header box of a list table shows for "some rows are ticked", and a box with
 * `appearance: none` paints nothing for that state unless a rule asks it to —
 * the state would survive in the DOM and vanish from the screen.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate = false, ...props }, ref) => {
    const innerRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    return (
      <input
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        type="checkbox"
        className={cn(
          'app-checkbox',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-border-control)]',
          className,
        )}
        {...props}
      />
    );
  },
);

Checkbox.displayName = 'Checkbox';
