import { useEffect, useRef, type RefObject } from 'react';

export interface UsePOSKeyboardShortcutsOptions {
  /** The catalogue's search box, focused by `/`. */
  searchRef: RefObject<HTMLInputElement | null>;
  /** `false` while a dialog owns the keyboard — its own controls come first. */
  enabled: boolean;
  /** `true` when there is something on the terminal worth checking out. */
  canCheckout: boolean;
  onCheckout: () => void;
}

/**
 * The two keys a cashier reaches for.
 *
 * `/` jumps to the catalogue search and `Enter` opens the checkout — the two
 * moves that keep hands off the mouse during a queue. Both are suppressed while
 * the target is a text field, because a `/` typed into a customer name is a
 * character, not a command.
 */
export function usePOSKeyboardShortcuts({
  searchRef,
  enabled,
  canCheckout,
  onCheckout,
}: UsePOSKeyboardShortcutsOptions): void {
  /*
   * Held in a ref rather than wired into the effect's dependencies.
   *
   * The handler is installed once per change of the *conditions*, and
   * `onCheckout` is rebuilt on every render because it closes over the cart.
   * Reading it through a ref means the key always fires the current one; listing
   * it as a dependency instead would tear down and reinstall the listener on
   * every keystroke in the customer-name box for no benefit.
   */
  const onCheckoutRef = useRef(onCheckout);
  onCheckoutRef.current = onCheckout;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!enabled) return;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;

      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Enter' && !isTyping && canCheckout) {
        event.preventDefault();
        onCheckoutRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canCheckout, enabled, searchRef]);
}
