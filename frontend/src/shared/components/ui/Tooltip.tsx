import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ children, content }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const updateCoords = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left + rect.width / 2,
      });
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

  /*
   * The portal and the coordinate tracking are the substance here; the entrance
   * animation that used to wrap the pill was decoration. Tracked coordinates are
   * what keep the pill attached to its trigger while the page scrolls.
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
            className="pointer-events-none fixed z-[9999]"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: 'translate(-50%, -100%) translateY(-10px)',
            }}
          >
            <div className="relative whitespace-nowrap rounded-full border border-white/35 bg-white/72 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-macos-text shadow-[var(--shadow-glass)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/78 dark:text-zinc-100">
              {content}
              <div className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-white/35 bg-white/72 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/78" />
            </div>
          </div>
        ),
        document.body,
      )}
    </div>
  );
};
