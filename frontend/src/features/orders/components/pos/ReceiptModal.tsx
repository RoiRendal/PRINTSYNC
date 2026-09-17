import { Printer, X } from 'lucide-react';
import { Button, Modal } from '../../../../shared/components/ui';
import { PrintableDocumentView } from './PrintableDocumentView';
import type { PrintableDocument } from '../../types/printableDocument';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The frozen document to show. `null` renders nothing. */
  document: PrintableDocument | null;
  onPrint?: () => void;
  /** Overrides the dialog title, e.g. when opened from a history row. */
  title?: string;
}

const DEFAULT_TITLE: Record<PrintableDocument['kind'], string> = {
  receipt: 'Receipt',
  order: 'Order Summary',
};

/**
 * A printable document in a dialog.
 *
 * Deliberately thin: it owns the dialog chrome and the two buttons, and hands
 * every pixel of the document itself to `PrintableDocumentView`. That split is
 * what lets the same paperwork be reopened from the POS terminal, the history
 * table, and the Orders page without three copies of the layout drifting apart.
 */
export function ReceiptModal({ isOpen, onClose, document, onPrint, title }: ReceiptModalProps) {
  const handlePrint = onPrint ?? (() => window.print());
  const resolvedTitle = title ?? (document ? DEFAULT_TITLE[document.kind] : 'Receipt');

  return (
    <Modal isOpen={isOpen && document !== null} onClose={onClose} title={resolvedTitle} maxWidth="max-w-md">
      {document && (
        <div className="space-y-5">
          <PrintableDocumentView document={document} />

          <div className="flex gap-3">
            <Button type="button" variant="secondary" fullWidth leftIcon={<X className="h-3.5 w-3.5" aria-hidden="true" />} onClick={onClose}>
              Close
            </Button>
            <Button type="button" fullWidth leftIcon={<Printer className="h-3.5 w-3.5" aria-hidden="true" />} onClick={handlePrint}>
              Print
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
