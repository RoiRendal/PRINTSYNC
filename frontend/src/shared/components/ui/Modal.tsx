import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from './icons';
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

  return createPortal(
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-[var(--app-scrim)] p-3 sm:p-4 lg:p-6"
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
            <div className="surface-toolbar flex min-h-10 items-center justify-between gap-3 border-b border-[var(--app-border-hairline)] px-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <h3 className="truncate text-sm font-bold tracking-tight text-app-ink dark:text-zinc-100">
                  {title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-app-text-muted hover:bg-[var(--app-state-hover)] hover:text-app-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-border-control)] dark:text-zinc-400 dark:hover:text-zinc-100"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto p-3 text-app-ink dark:text-zinc-100 sm:p-4">
              {children}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
};
