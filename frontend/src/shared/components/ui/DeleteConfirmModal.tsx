import type { ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  /**
   * One entry per object the delete will take, named in full.
   *
   * Never collapsed to a count: the whole point of the dialog is that the user
   * can read exactly which rows are about to go. A tick on a filtered or paged
   * table is easy to over-apply, and this list is the last chance to notice.
   */
  itemLabels: string[];
  onClose: () => void;
  onConfirm: () => void;
  /** True while the delete is running: Cancel is blocked and Confirm spins. */
  isBusy?: boolean;
  /** Caller-specific context (warnings, errors), rendered under the message. */
  children?: ReactNode;
}

/**
 * The only delete confirmation in the app.
 *
 * Every surface that deletes something routes through here so the wording, the
 * button labels and the spacing cannot drift apart — previously each page grew
 * its own variant, and they disagreed on the copy, the confirm label and whether
 * a warning icon was involved.
 *
 * There is deliberately no icon and no coloured panel. The weight of a delete is
 * carried by naming what is about to disappear, not by decoration around it.
 */
export function DeleteConfirmModal({
  isOpen,
  itemLabels,
  onClose,
  onConfirm,
  isBusy = false,
  children,
}: DeleteConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Deletion" maxWidth="max-w-sm">
      <div className="space-y-4">
        <div className="space-y-3">
          <p className="text-sm text-macos-text dark:text-zinc-100">Are you sure you want to delete:</p>
          {itemLabels.length > 0 && (
            <ul className="list-none space-y-1">
              {itemLabels.map((label, index) => (
                // Two rows can legitimately share a name, so the index is part
                // of the key rather than the label alone.
                <li
                  key={`${label}-${index}`}
                  className="text-sm font-bold text-macos-text dark:text-zinc-100"
                >
                  {label}
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-macos-text dark:text-zinc-100">This action cannot be undone.</p>
          {children}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" fullWidth onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button type="button" variant="danger" fullWidth isLoading={isBusy} onClick={onConfirm}>
            Confirm
          </Button>
        </div>
      </div>
    </Modal>
  );
}
