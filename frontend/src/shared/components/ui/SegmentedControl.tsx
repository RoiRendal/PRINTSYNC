import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  /** Optional leading glyph, e.g. the Stock List / Design Repo switch. */
  icon?: ReactNode;
  /**
   * Override the selected fill. The default is the app accent, but a control
   * whose options carry meaning of their own can pass one per option — the
   * forecast switch is green for Income and amber for Expenses, and flattening
   * that to the accent would lose the distinction it is drawing.
   */
  selectedClassName?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The group's name. This renders as a radio group, so it needs one. */
  'aria-label': string;
  /** `md` = 32px (page controls, the default); `sm` = 28px (toolbars). */
  size?: 'sm' | 'md';
  /** Stretch the options evenly to fill the track (the theme switch). */
  fill?: boolean;
  /**
   * Locks the whole group. Needed by a control that sits inside a form being
   * submitted — the payment-method switch in the POS checkout must not move
   * once the sale is in flight.
   */
  disabled?: boolean;
  className?: string;
}

const sizeClasses: Record<'sm' | 'md', string> = {
  sm: 'h-7',
  md: 'h-8',
};

/*
  The selected option is a ONE-STEP-DARKER GREY, not the accent.

  ERPNext draws its active state this way — `.btn-primary-light` on the live demo
  is `#e2e2e2` with `#171717` ink, never a dark fill. PrintSync's equivalent rung
  on the flat ladder is `--app-state-hover-sub` (`#dedee3` light / `#48484a`
  dark), which measures 1.34:1 against a white card: clearly a step, and darker
  than the 1.18:1 resting button beside it, so it still reads as selected.

  The accent was the wrong tool here. It is the app's single loudest value, and
  spending it on "which tab am I on" left nothing to say "this is the one action
  to press". Hue still wins where it carries meaning of its own — see the
  `selectedClassName` escape hatch the forecast switch uses for Income/Expenses.
*/
const defaultSelected = 'bg-[var(--app-state-hover-sub)] text-app-ink dark:text-zinc-100';

const unselected =
  'text-app-text-muted hover:bg-[var(--app-state-hover)] dark:text-zinc-400 dark:hover:bg-[var(--app-tint-neutral)]';

/**
 * A small switch between mutually exclusive options: Retail/Custom, the period
 * selector, the theme switch. One selected value, one track — which is the
 * difference between this and a row of filter chips.
 *
 * These were hand-rolled in five places with identical classes before this
 * component existed, so the markup had to be copied every time a new switch was
 * wanted. It is a radio group rather than a row of buttons: arrow keys move the
 * selection, and focus follows it, which the raw buttons did not do.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  size = 'md',
  fill = false,
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);

  const move = (delta: number) => {
    if (disabled) return;
    const index = options.findIndex((option) => option.value === value);
    if (index < 0) return;
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    // Focus follows the selection, the way a radio group is expected to behave.
    // The buttons re-render first, so pick the new one up on the next frame.
    requestAnimationFrame(() => {
      const radios = trackRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      radios?.[next]?.focus();
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    }
  };

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn('flex items-center rounded-full border p-1', className)}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            tabIndex={isSelected && !disabled ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'cursor-pointer rounded-full px-3 text-2xs font-bold',
              'disabled:cursor-not-allowed disabled:opacity-55',
              sizeClasses[size],
              option.icon && 'flex items-center gap-2',
              fill && 'flex-1',
              isSelected ? option.selectedClassName ?? defaultSelected : unselected,
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
