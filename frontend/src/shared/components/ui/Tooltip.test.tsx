/**
 * The tooltip's placement logic.
 *
 * `Tooltip` portals a pill into `document.body` and pins it with
 * `position: fixed`, so its placement is arithmetic on the trigger's viewport
 * rect. That arithmetic is the whole component, and it carried a defect no
 * existing test could see: the pill was always translated upward, so the header
 * theme button — whose rect starts at y ≈ 6px in a 48px toolbar — had its
 * tooltip rendered entirely above the viewport. The markup and the copy were
 * both correct, so every query-based assertion would have passed.
 *
 * jsdom performs no layout: `getBoundingClientRect()` returns zeros and
 * `offsetWidth` / `offsetHeight` are always 0. All three are therefore supplied
 * explicitly. The pill's size is keyed off the wrapper's own `w-max` class
 * rather than a test id, so the component carries no test-only markup.
 *
 * These tests also cover the *reason* the arrow uses a template literal instead
 * of `cn()`: if it were routed through tailwind-merge, an arbitrary border
 * colour could be treated as a competing border width and take a side with it.
 */
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from './Tooltip';

const VIEWPORT_WIDTH = 1024;
const PILL_WIDTH = 280;
const PILL_HEIGHT = 28;
/** Must track the constants in `Tooltip.tsx`. */
const GAP = 10;
const EDGE = 8;

const rect = (top: number, left: number, width = 36, height = 36): DOMRect =>
  ({
    top,
    bottom: top + height,
    left,
    right: left + width,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

/** The portal wrapper — `fixed` plus `pointer-events-none` is unique to it. */
const pill = () => document.body.querySelector<HTMLElement>('.pointer-events-none.fixed');
const arrow = () => pill()?.querySelector<HTMLElement>('.absolute') ?? null;

const showTooltipAt = async (triggerRect: DOMRect) => {
  const { container } = render(
    <Tooltip content="Theme: System (click for Light)">
      <button type="button">theme</button>
    </Tooltip>,
  );
  const trigger = container.firstElementChild as HTMLElement;
  trigger.getBoundingClientRect = () => triggerRect;
  fireEvent.mouseEnter(trigger);
  // The pill renders hidden until it has been measured, so waiting for
  // `visible` is what proves the layout effect ran.
  await waitFor(() => expect(pill()?.style.visibility).toBe('visible'));
  return trigger;
};

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_WIDTH, configurable: true });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('w-max') ? PILL_WIDTH : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('w-max') ? PILL_HEIGHT : 0;
  });
});

describe('Tooltip placement', () => {
  it('flips below the trigger when there is no room above', async () => {
    // The reported defect. The header is 48px tall at the top of the window, so
    // the theme button's rect starts at y ≈ 6px; the pill needs
    // PILL_HEIGHT + GAP + EDGE = 46px of clearance, and 6 < 46.
    await showTooltipAt(rect(6, 400));

    expect(pill()!.style.top).toBe(`${6 + 36 + GAP}px`);
    // The chevron turns with the pill: top-left borders point upward.
    expect(arrow()!.className).toContain('bottom-full');
    expect(arrow()!.className).toContain('border-t');
    expect(arrow()!.className).not.toContain('border-b');
    // The arbitrary border colour must survive alongside the side classes.
    expect(arrow()!.className).toContain('border-[var(--app-hairline)]');
  });

  it('stays above the trigger when there is room', async () => {
    await showTooltipAt(rect(300, 400));

    expect(pill()!.style.top).toBe(`${300 - GAP - PILL_HEIGHT}px`);
    expect(arrow()!.className).toContain('top-full');
    expect(arrow()!.className).toContain('border-b');
    expect(arrow()!.className).not.toContain('border-t');
  });

  it('keeps a pill centred near the right edge inside the viewport', async () => {
    // Centring on the trigger would put the pill's right edge past the window,
    // so it is pulled back by exactly the overflow.
    await showTooltipAt(rect(6, 1000));

    expect(pill()!.style.left).toBe(`${VIEWPORT_WIDTH - EDGE - PILL_WIDTH / 2}px`);
  });

  it('centres horizontally when there is room on both sides', async () => {
    await showTooltipAt(rect(300, 400));

    expect(pill()!.style.left).toBe(`${400 + 36 / 2}px`);
  });

  it('removes the pill when the pointer leaves', async () => {
    const trigger = await showTooltipAt(rect(300, 400));

    fireEvent.mouseLeave(trigger);

    await waitFor(() => expect(pill()).toBeNull());
  });
});
