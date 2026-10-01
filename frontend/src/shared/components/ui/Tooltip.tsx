import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
}

/**
 * The widest the bubble is allowed to get before it wraps onto another line.
 *
 * At 288px (`max-w-72`) a sentence reads as a sentence instead of as one long
 * strip, and the bubble can still sit beside a toolbar control without covering
 * the screen. It is a maximum, not a width: a two-word hint stays as small as it
 * was.
 */
const TOOLTIP_MAX_WIDTH = 288;

/**
 * Half the bubble's maximum width, plus a small margin. Used to keep the bubble
 * inside the viewport: the trigger is frequently a control at the far right of
 * the header, where centring the bubble on it would hang half of it off screen.
 */
const TOOLTIP_EDGE_INSET = TOOLTIP_MAX_WIDTH / 2 + 8;

export const Tooltip: React.FC<TooltipProps> = ({ children, content }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, offset: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const updateCoords = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const centred = rect.left + rect.width / 2;
      /*
       * Clamped to the viewport. Without this the bubble is centred on its
       * trigger and simply runs off the edge — which is what happened to any
       * hint longer than a couple of words, and is the other half of the same
       * problem the width cap solves.
       */
      const maxLeft = window.innerWidth - TOOLTIP_EDGE_INSET;
      const left = Math.min(Math.max(centred, TOOLTIP_EDGE_INSET), maxLeft);
      /*
       * Once the bubble is clamped it is no longer centred on its trigger, so
       * the arrow has to move back over it. Without this the pointer points at
       * empty space at the right edge of the screen, which is worse than no
       * arrow at all.
       */
      setCoords({ top: rect.top, left, offset: centred - left });
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isVisible, updateCoords]);

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
        isVisible ? (
          <div
            className="pointer-events-none fixed z-[9999]"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: 'translate(-50%, -100%) translateY(-10px)',
            }}
          >
            {/*
              A softer corner than the old `rounded-full`. A pill is shaped for
              one short line; once the bubble can wrap, a fully round end reads
              as a mis-drawn capsule against two or three lines of text.

              `whitespace-nowrap` came off with it, so the text wraps inside
              `max-w-72` rather than stretching into one very wide strip.

              `w-max` is load-bearing, not tidying. The bubble is inside a
              `position: fixed` wrapper, which shrink-wraps to its containing
              block rather than to its text: with only `max-width` set, the
              browser resolved the width against that containing block and
              collapsed a whole sentence into a ~66px column, 150px tall. Sized
              to `max-content` first and then capped, a short hint takes exactly
              the width it needs and a long one stops at 288px and wraps —
              measured at 288x40 for a sentence, 121x25 for a phrase.

              Weight is regular, not bold: the bubble is a gloss on the control
              it points at, and bold type made it compete with the control.
            */}
            <div className="relative w-max max-w-72 rounded-md border border-[var(--app-border-hairline)] bg-[var(--app-surface-raised)] px-2 py-1 text-2xs font-normal text-app-ink dark:text-zinc-100">
              {content}
              <div
                className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-[var(--app-border-hairline)] bg-[var(--app-surface-raised)]"
                style={{ marginLeft: `${coords.offset}px` }}
              />
            </div>
          </div>
        ) : null,
        document.body,
      )}
    </div>
  );
};
