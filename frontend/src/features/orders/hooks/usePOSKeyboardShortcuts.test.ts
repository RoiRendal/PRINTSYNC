import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { usePOSKeyboardShortcuts } from './usePOSKeyboardShortcuts';

/**
 * Characterisation tests for the till's two shortcuts.
 *
 * These pin what `POSPage` already did — `/` focuses the catalogue search,
 * `Enter` opens the checkout — and in particular that neither fires while the
 * cashier is typing, which is the failure that would make the shortcuts a
 * nuisance rather than a help.
 */

let input: HTMLInputElement;

function mountInput() {
  input = document.createElement('input');
  document.body.appendChild(input);
  return input;
}

afterEach(() => {
  input?.remove();
});

function press(key: string, target: Element | null = null) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  (target ?? document.body).dispatchEvent(event);
  return event;
}

function renderShortcuts(overrides: Partial<Parameters<typeof usePOSKeyboardShortcuts>[0]> = {}) {
  const searchRef = createRef<HTMLInputElement>();
  const onCheckout = vi.fn();
  const view = renderHook(() =>
    usePOSKeyboardShortcuts({
      searchRef,
      enabled: true,
      canCheckout: true,
      onCheckout,
      ...overrides,
    }),
  );
  return { ...view, searchRef, onCheckout };
}

describe('usePOSKeyboardShortcuts', () => {
  describe('"/" focuses the catalogue search', () => {
    it('focuses the search box', () => {
      const { searchRef } = renderShortcuts();
      mountInput();
      searchRef.current = input;
      document.body.focus();

      press('/');

      expect(document.activeElement).toBe(input);
    });

    it('does not steal focus while a name is being typed', () => {
      const { searchRef } = renderShortcuts();
      mountInput();
      searchRef.current = input;
      const nameBox = document.createElement('input');
      document.body.appendChild(nameBox);

      press('/', nameBox);

      expect(document.activeElement).not.toBe(input);
      nameBox.remove();
    });

    it('does nothing while a dialog owns the keyboard', () => {
      const { searchRef } = renderShortcuts({ enabled: false });
      mountInput();
      searchRef.current = input;

      press('/');

      expect(document.activeElement).not.toBe(input);
    });
  });

  describe('Enter opens the checkout', () => {
    it('checks out when there is something to sell', () => {
      const { onCheckout } = renderShortcuts();

      press('Enter');

      expect(onCheckout).toHaveBeenCalledOnce();
    });

    it('does nothing on an empty basket', () => {
      const { onCheckout } = renderShortcuts({ canCheckout: false });

      press('Enter');

      expect(onCheckout).not.toHaveBeenCalled();
    });

    it('does nothing while a dialog owns the keyboard', () => {
      const { onCheckout } = renderShortcuts({ enabled: false });

      press('Enter');

      expect(onCheckout).not.toHaveBeenCalled();
    });

    it('does not fire on Enter inside a textarea', () => {
      const { onCheckout } = renderShortcuts();
      const notes = document.createElement('textarea');
      document.body.appendChild(notes);

      press('Enter', notes);

      expect(onCheckout).not.toHaveBeenCalled();
      notes.remove();
    });

    it('fires the current handler, not the one from when the listener was installed', () => {
      const first = vi.fn();
      const second = vi.fn();
      const searchRef = createRef<HTMLInputElement>();
      const view = renderHook(
        ({ onCheckout }: { onCheckout: () => void }) =>
          usePOSKeyboardShortcuts({ searchRef, enabled: true, canCheckout: true, onCheckout }),
        { initialProps: { onCheckout: first } },
      );

      view.rerender({ onCheckout: second });
      press('Enter');

      expect(second).toHaveBeenCalledOnce();
      expect(first).not.toHaveBeenCalled();
    });
  });

  it('stops listening once the screen goes away', () => {
    const { onCheckout, unmount } = renderShortcuts();

    unmount();
    press('Enter');

    expect(onCheckout).not.toHaveBeenCalled();
  });
});
