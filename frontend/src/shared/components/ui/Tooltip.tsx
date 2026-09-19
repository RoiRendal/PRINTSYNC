import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
}

type Placement = 'top' | 'bottom';

interface Coords {
  top: number;
  left: number;
  placement: Placement;
}

/** Clearance between the pill and the trigger it points at. */
const GAP = 10;
/** Clearance kept from the viewport edge, so the pill never touches the frame. */
const EDGE = 8;

export const Tooltip: React.FC<TooltipProps> = ({ children, content }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  const updateCoords = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = pillRef.current?.offsetWidth ?? 0;
    const height = pillRef.current?.offsetHeight ?? 0;

    /*
     * Above by default — a tooltip that covers the control it describes is
     * worse than one that points at it — but flip below when the pill would
     * leave the top of the viewport.
     *
     * This is the defect the header exposed: the theme button sits at y ≈ 6px,
     * the pill is ~28px tall, and the old unconditional `translateY(-100%)`
     * therefore placed its bottom edge at -4px. The tooltip was not merely
     * mis-positioned, it was entirely off-screen, and no amount of scrolling
     * could bring it back.
     *
     * The measurement is of the pill itself rather than a hard-coded height,
     * so a longer string or a wrapped label moves the flip point with it.
     */
    const placement: Placement = rect.top >= height + GAP + EDGE ? 'top' : 'bottom';

    const top = placement === 'top' ? rect.top - GAP - height : rect.bottom + GAP;

    /*
     * Centred on the trigger, then pulled back inside the viewport. The theme
     * button lives in the header's right-hand cluster, so a ~280px pill centred
     * on it is one narrow window away from being clipped sideways too. A pill
     * wider than the viewport keeps its left edge at EDGE rather than being
     * clamped to a negative position.
     */
    const half = width / 2;
    const low = EDGE + half;
    const high = window.innerWidth - EDGE - half;
    const centre = rect.left + rect.width / 2;
    const left = high < low ? low : Math.min(Math.max(centre, low), high);

    setCoords({ top, left, placement });
  }, []);

  /*
   * A layout effect, not a plain effect: the pill is measured once the DOM is
   * committed but before the browser paints, so it is never seen at the
   * unmeasured position. Until the measurement lands it renders `hidden` —
   * visible to layout, invisible to the eye.
   */
  useLayoutEffect(() => {
    if (!isVisible) {
      // Drop the stale measurement so a re-open re-measures instead of
      // flashing at wherever the pill last was.
      setCoords(null);
      return;
    }
    updateCoords();
  }, [isVisible, content, updateCoords]);

  useEffect(() => {
    if (!isVisible) return;
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isVisible, updateCoords]);

  /*
   * The portal and the coordinate tracking are the substance here; the entrance
   * animation that used to wrap the pill was decoration. Tracked coordinates are
   * what keep the pill attached to its trigger while the page scrolls.
   *
   * Phase 4 gives the pill `amb-elevation-2` — it floats well clear of the
   * trigger, so it should be lit as something hovering. It previously borrowed
   * `--shadow-modal`, which is a shadow for a panel that owns the whole screen:
   * `0 24px 80px` on a 20px-tall pill is far more shadow than the object casting
   * it. `.ambient` owns `box-shadow`, so that class is removed rather than left
   * in place looking as though it still applies.
   *
   * The arrow is a separate rotated square and takes no material — at 10px it
   * would show a bevel as a smudge, not as depth. It has to turn with the pill:
   * a downward chevron is two borders on the bottom-right of a 45°-rotated
   * square, an upward one is the same square's top-left borders.
   */
  return (
    <div
      ref={triggerRef}
      className="inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {createPortal(
        isVisible && (
          <div
            ref={pillRef}
            className="pointer-events-none fixed z-[9999] w-max"
            style={{
              top: `${coords?.top ?? 0}px`,
              left: `${coords?.left ?? 0}px`,
              transform: 'translateX(-50%)',
              visibility: coords ? 'visible' : 'hidden',
            }}
          >
            <div className="ambient amb-elevation-2 relative whitespace-nowrap rounded-full border border-[var(--app-hairline)] bg-[var(--app-surface-raised)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-macos-text dark:text-zinc-100">
              {content}
              {/*
                A template literal rather than `cn()` on purpose. The two
                branches are mutually exclusive and nothing here conflicts, so
                there is nothing for tailwind-merge to resolve — while
                `border-[var(--app-hairline)]` is an arbitrary value it cannot
                confidently classify, which risks it discarding `border-t` /
                `border-b` as a competing border-width and silently flattening
                the chevron.
              */}
              <div
                className={`absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-[var(--app-hairline)] bg-[var(--app-surface-raised)] ${
                  coords?.placement === 'bottom'
                    ? 'bottom-full translate-y-1/2 border-l border-t'
                    : 'top-full -translate-y-1/2 border-b border-r'
                }`}
              />
            </div>
          </div>
        ),
        document.body,
      )}
    </div>
  );
};
