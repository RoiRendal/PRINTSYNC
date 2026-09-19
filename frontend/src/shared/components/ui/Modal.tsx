import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  /*
   * Mounted/unmounted directly rather than kept alive for an exit animation.
   * The overlay and the panel classes below are load-bearing for print: the
   * receipt renders inside this subtree, and the `@media print` block in
   * `index.css` neutralises `backdrop-filter` / `overflow` / `max-height` /
   * `position` on the whole ancestor chain. Changing these class names changes
   * what the printer receives — see `printStyles.test.ts`.
   *
   * `backdrop-blur-md` on the overlay is the one blur Phase 3 deliberately kept.
   * It is a scrim rather than a surface — it defocuses the page *behind* the
   * dialog instead of pretending to be frosted material, so it carries no
   * "glass panel" signal. It is also neutralised for print, so it cannot affect
   * the receipt either way.
   *
   * Phase 4 adds `ambient amb-elevation-3` to the panel: a dialog is the
   * furthest thing from the page, so it takes the top of the elevation ladder.
   *
   * It is a plain `.ambient` and not one of the grained materials
   * (`.amb-mat-brushed` / `-blasted`) on purpose. Those set `overflow: hidden`
   * and `isolation: isolate`, which would create a stacking context around the
   * whole dialog — and the receipt inside this subtree is absolutely positioned,
   * as are several overlays in the dialogs that build on `Modal`. `.ambient`
   * itself sets neither property, so it is safe here.
   *
   * `.surface-modal` is kept for its background and hairline border. Its
   * `box-shadow` is now superseded by the material, which is unlayered and
   * therefore wins.
   */
  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-md sm:p-6 lg:p-10"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={cn(
          'surface-modal ambient amb-elevation-3 flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[var(--radius-modal)] sm:max-h-[calc(100vh-3rem)] lg:max-h-[calc(100vh-5rem)]',
          maxWidth,
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="surface-toolbar flex min-h-12 items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <h3 className="truncate text-sm font-bold tracking-tight text-macos-text dark:text-zinc-100">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            /*
             * `focus-visible:ring-*` is replaced by `.mat-focus`, which draws an
             * `outline`. This button is the one control in the dialog that must
             * never lose its focus indicator — it is the keyboard escape route —
             * and a ring is a box-shadow, which the dialog's own material would
             * now compete with.
             */
            className="mat-focus flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-macos-text-muted transition-colors hover:bg-black/5 hover:text-macos-text dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 text-macos-text dark:text-zinc-100 sm:p-5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
};
