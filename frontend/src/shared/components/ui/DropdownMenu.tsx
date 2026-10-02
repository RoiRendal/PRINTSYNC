import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';
import { Button } from './Button';
import { ChevronDown } from './icons';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

export interface DropdownMenuProps<T extends string> {
  /** The chosen option — the menu is controlled, so the URL or a store owns it. */
  value: T;
  options: readonly DropdownOption<T>[];
  onChange: (value: T) => void;
  /**
   * Names the control for a screen reader. The trigger's visible text is the
   * CURRENT choice, which says what is selected but not what is being chosen —
   * "List View" alone does not tell anyone this is the view picker.
   */
  ariaLabel: string;
  className?: string;
}

/** Gap between the trigger's bottom edge and the panel. */
const PANEL_GAP = 4;

/** Keep the panel this far from the viewport edge when clamped. */
const VIEWPORT_INSET = 8;

/**
 * How far the panel may sit from the bottom of the screen before it flips above
 * the trigger. `PANEL_MAX_HEIGHT` is the panel's own cap, so the test is whether
 * a full-height panel still fits below.
 */
const PANEL_MAX_HEIGHT = 320;

/**
 * A single-choice menu: a button showing the current pick, and a floating panel
 * of options.
 *
 * ### Why it is portalled and fixed-positioned
 *
 * The trigger lives inside a card header that clips its overflow (`Card` is
 * `overflow-hidden` on every list page), so a panel rendered as its child would
 * be cut off at the card's edge. `createPortal` to `document.body` lifts it out
 * of that clip entirely, and `position: fixed` anchors it to the trigger's
 * `getBoundingClientRect()` — the same approach `Tooltip` uses, for the same
 * reason.
 *
 * ### Why the panel carries its own background
 *
 * `.surface-panel` is a border with NO fill, so it would be transparent over
 * whatever is behind it. A floating surface has to declare its own.
 *
 * ### Why `menuitemradio` and not `menuitem`
 *
 * These options are mutually exclusive — exactly one is chosen at a time — and
 * `aria-checked` is how that is announced. A bare `menuitem` tells a screen
 * reader "here is an action", which is not what picking a view is.
 */
export function DropdownMenu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: DropdownMenuProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const current = options.find((option) => option.value === value) ?? options[0];

  const close = useCallback((returnFocus: boolean) => {
    setIsOpen(false);
    setPlacement(null);
    /*
     * Focus goes back to the trigger. Without this, closing the menu leaves
     * focus on a node that has just been unmounted, and the browser drops it to
     * the top of the document — so the next Tab starts from the sidebar instead
     * of from where the user was working.
     */
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  /*
   * Position is measured, not guessed: the panel's size depends on its content,
   * so it is laid out first and then moved. `useLayoutEffect` runs before paint,
   * so the move happens before the user can see the unplaced panel — hence
   * `placement === null` rendering it invisible rather than at 0,0.
   */
  useLayoutEffect(() => {
    if (!isOpen) return;

    const place = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;

      const rect = trigger.getBoundingClientRect();
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;

      let left = rect.left;
      if (left + width > window.innerWidth - VIEWPORT_INSET) {
        left = window.innerWidth - width - VIEWPORT_INSET;
      }
      if (left < VIEWPORT_INSET) left = VIEWPORT_INSET;

      let top = rect.bottom + PANEL_GAP;
      if (top + height > window.innerHeight - VIEWPORT_INSET) {
        top = Math.max(VIEWPORT_INSET, rect.top - height - PANEL_GAP);
      }

      setPlacement({ top, left });
    };

    place();
    // Capture phase: the panel sits above a scrollable page body, and a scroll
    // inside any ancestor moves the trigger without moving the fixed panel.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [isOpen]);

  /**
   * Focus the current choice once per opening — and only once the panel is
   * actually placed.
   *
   * Two things make this less obvious than it looks:
   *
   * 1. **An element with `visibility: hidden` cannot take focus.** The panel
   *    starts hidden so it is never painted unplaced, so focusing it on the same
   *    pass silently does nothing and focus stays on the trigger. Waiting for
   *    `placement` is what makes the call land.
   * 2. **`placement` also changes on scroll and resize**, and this effect must
   *    not re-run then — dragging the page with the menu open would otherwise
   *    keep yanking focus back to the current option.
   */
  const hasFocusedOnOpen = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasFocusedOnOpen.current = false;
      return;
    }
    if (!placement || hasFocusedOnOpen.current) return;
    hasFocusedOnOpen.current = true;
    const index = options.findIndex((option) => option.value === value);
    itemRefs.current[index >= 0 ? index : 0]?.focus();
  }, [isOpen, placement, options, value]);

  // Click outside, and Escape from anywhere.
  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(true);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, close]);

  const focusAt = (index: number) => {
    const count = options.length;
    const next = ((index % count) + count) % count;
    itemRefs.current[next]?.focus();
  };

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = itemRefs.current.findIndex((item) => item === document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusAt(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusAt(options.length - 1);
    }
  };

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="secondary"
        // `h-7` matches every other control in the toolbar row; `px-2` and the
        // 2xs label keep it from dwarfing the search box beside it.
        className={cn('h-7 shrink-0 gap-1 px-2 text-2xs font-bold', className)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? close(true) : setIsOpen(true))}
        onKeyDown={(event) => {
          // Arrow keys open the menu rather than moving the page, which is what
          // a native `select` does.
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        {current?.label}
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </Button>

      {createPortal(
        isOpen ? (
          <div
            ref={panelRef}
            role="menu"
            aria-label={ariaLabel}
            onKeyDown={onPanelKeyDown}
            className="fixed z-[9999] w-max min-w-[9rem] overflow-y-auto rounded-[var(--radius-card)] border border-[var(--app-border-hairline)] bg-[var(--app-surface-raised)] p-1"
            style={{
              top: placement ? `${placement.top}px` : 0,
              left: placement ? `${placement.left}px` : 0,
              maxHeight: `${PANEL_MAX_HEIGHT}px`,
              // Invisible until measured, so it is never painted in the corner.
              visibility: placement ? 'visible' : 'hidden',
            }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  ref={(node) => { itemRefs.current[index] = node; }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    close(true);
                  }}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-button)] px-2 py-1.5 text-left text-2xs',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-border-control)]',
                    /*
                      Selected is one grey step darker — the app's rule for a
                      chosen state (R23) — never the accent. A coloured tick or
                      a filled dot would spend the app's one hue budget on a
                      control whose label already says which one is picked.
                    */
                    isSelected
                      ? 'bg-[var(--app-state-hover)] font-bold text-app-ink dark:text-zinc-100'
                      : 'font-normal text-app-text-muted hover:bg-[var(--app-state-hover)] hover:text-app-ink dark:text-zinc-400 dark:hover:text-zinc-200',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null,
        document.body,
      )}
    </>
  );
}
