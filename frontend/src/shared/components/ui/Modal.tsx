import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from './icons';
import { cn } from '../../lib/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /**
   * ERPNext has three dialog sizes — 575 / 800 / 1140px — and picks one from how
   * many columns the form inside needs. This prop is that mechanism; 575px is
   * only the default. Every call site in the app passes it explicitly, so
   * nothing depends on the default value.
   */
  maxWidth?: string;
  /**
   * The dialog's action row, in its own region pinned under the body.
   *
   * Pass two elements to get ERPNext's `.modal-footer` arrangement: the first
   * sits left and the last sits right — secondary left, primary right, so the
   * dominant action lands where the eye already is.
   *
   * Omit it and the dialog has no action row, which is correct for the read-only
   * dialogs in the app.
   */
  footer?: React.ReactNode;
}

/*
  ERPNext's dialog shell.

  The values below are read out of the stylesheet the live demo actually serves,
  not eyeballed off a screenshot. The reference — every measured value, plus a
  1:1 rebuild verified against the screenshot — is
  `docs/erpnext-modal-ui-reference.html`.

    panel     max-width 575px (the default size), radius 12px
    header    15px / 20px padding, 16px title at weight 500, 1px bottom rule
    body      15px / 20px padding
    footer    15px / 20px padding, 1px top rule, secondary left / primary right
    close     28px square, 8px radius, 14px glyph

  The header is deliberately NOT `surface-toolbar`. ERPNext's `.modal-header` is
  `background: inherit` — the same surface as the body — separated from it by the
  rule alone. `surface-toolbar` is the grey that table headers use, and reusing it
  here made the dialog's header read as a toolbar sitting on top of the dialog.

  Two ERPNext values are deliberately not reproduced, because a standing rule
  outranks fidelity:

  - the elevation on `.modal-content` (`0 5px 10px`). `check-flat-ui` bans
    elevation outright, and the flat plan's position is that a panel is separated
    by its outline, not by a drop beneath it. The dialog therefore keeps its 1px
    border — and that border is the stronger `--app-border-hairline` rather than
    ERPNext's lighter `#ededed`, because with the elevation gone a lighter rule
    would leave the dialog under-separated from the page behind it.
  - the open motion (`.modal.fade` rising from -15%). The same gate bans
    animations and durations outright, so the dialog appears instantly.
    `--app-scrim-modal` carries the weight the missing motion would have.
*/
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-[575px]',
  footer,
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

  return createPortal(
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-[var(--app-scrim-modal)] p-3 sm:p-4 lg:p-6"
          onClick={onClose}
          role="presentation"
        >
          <div
            className={cn(
              'surface-modal flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[var(--radius-modal)] sm:max-h-[calc(100vh-3rem)] lg:max-h-[calc(100vh-5rem)]',
              maxWidth,
            )}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {/* `items-start` is ERPNext's own `align-items: flex-start`: the 28px
                button is shorter than the 32px title line box, so it sits high
                rather than centred on the title. `pr-[6px]` is measured, not
                arbitrary — with the button's 28px box it puts the 14px glyph's
                centre on the same 20px inset the title starts from, which is what
                makes the two edges read as balanced. */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--app-border-hairline)] py-[15px] pl-5 pr-[6px]">
              <h3 className="min-w-0 truncate text-base font-medium leading-8 tracking-tight text-app-ink dark:text-zinc-100">
                {title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-button)] text-app-text-muted hover:bg-[var(--app-state-hover)] hover:text-app-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-border-control)] dark:text-zinc-400 dark:hover:text-zinc-100"
                aria-label="Close modal"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-[15px] text-app-ink dark:text-zinc-100">
              {children}
            </div>
            {footer && (
              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--app-border-hairline)] px-5 py-[15px]">
                {footer}
              </div>
            )}
          </div>
        </div>
      )}
    </>,
    document.body,
  );
};
