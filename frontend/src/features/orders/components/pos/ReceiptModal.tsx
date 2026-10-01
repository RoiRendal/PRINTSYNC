import { Button, Modal } from '../../../../shared/components/ui';
import { PrintableDocumentView } from './PrintableDocumentView';
import type { PrintableDocument } from '../../types/printableDocument';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The frozen document to show. `null` renders nothing. */
  document: PrintableDocument | null;
  onPrint?: () => void;
  /**
   * Present only when there is a sale to move on from — i.e. the receipt for the
   * sale that just happened. Its presence is what tells the dialog whether to
   * offer "New Order" or "Close", which are the same action described two ways:
   * after a sale the cashier is starting the next one, and after a reprint from
   * history they are done.
   */
  onNewOrder?: (() => void) | undefined;
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
export function ReceiptModal({ isOpen, onClose, document, onPrint, onNewOrder, title }: ReceiptModalProps) {
  const handlePrint = onPrint ?? (() => window.print());
  const resolvedTitle = title ?? (document ? DEFAULT_TITLE[document.kind] : 'Receipt');

  return (
    <Modal isOpen={isOpen && document !== null} onClose={onClose} title={resolvedTitle} maxWidth="max-w-md">
      {document && (
        <div className="space-y-5">
          <PrintableDocumentView document={document} />

          {/*
            ERPNext's action row also offers "Email Receipt". It is NOT here, and
            deliberately: there is no email capability anywhere in this stack —
            no mail transport on the API, no send route, nothing to call. A button
            that cannot send is worse than a missing one, because the cashier
            would tell the customer it had been sent. It goes in when there is
            something behind it.

            One dark button, per the button-weight rule: printing is the
            secondary act and moving to the next customer is the primary one.
          */}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" fullWidth onClick={handlePrint}>
              {document.kind === 'receipt' ? 'Print Receipt' : 'Print Order Summary'}
            </Button>
            {onNewOrder ? (
              <Button type="button" variant="primary" fullWidth onClick={onNewOrder}>
                New Order
              </Button>
            ) : (
              <Button type="button" variant="secondary" fullWidth onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
