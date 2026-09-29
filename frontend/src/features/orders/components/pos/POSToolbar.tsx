import { History, ReceiptText, ShoppingBag } from '../../../../shared/components/ui/icons';
import { Button, SegmentedControl, SurfaceCard } from '../../../../shared/components/ui';
import type { PosMode } from '../../hooks/usePOSCart';
import type { PrintableDocument } from '../../types/printableDocument';

export interface POSToolbarProps {
  view: 'pos' | 'history';
  onViewChange: (view: 'pos' | 'history') => void;
  posMode: PosMode;
  /** Switches mode and resets the basket for the new one. */
  onSelectMode: (mode: PosMode) => void;
  /** The last completed sale, kept printable after the dialog closed. */
  lastDocument: { document: PrintableDocument; label: string } | null;
  onReopenLastDocument: () => void;
}

/**
 * The top bar of the POS screen: the Terminal/History view switch, the
 * Retail/Custom mode switch, and the "Last receipt" button that reopens the
 * paperwork for the most recent sale after the checkout dialog has dismissed
 * itself.
 *
 * Pure presentational — every action is handed back to the page, which owns the
 * state behind it. It exists only to lift this markup out of `POSPage`, which had
 * grown to 900+ lines (R11).
 */
export function POSToolbar({
  view,
  onViewChange,
  posMode,
  onSelectMode,
  lastDocument,
  onReopenLastDocument,
}: POSToolbarProps) {
  return (
    <SurfaceCard className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
      {/*
        Terminal/History was two Buttons whose variant came from the current
        view, so one of the pair was permanently dark — a two-state selector
        wearing a button's clothes, sitting directly beside a real
        SegmentedControl doing the same job for the order mode. It is now the
        same component as its neighbour, which also means arrow keys move it.
      */}
      <SegmentedControl
        aria-label="POS view"
        size="sm"
        value={view}
        onChange={onViewChange}
        options={[
          { value: 'pos', label: 'Terminal', icon: <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" /> },
          { value: 'history', label: 'History', icon: <History className="h-3.5 w-3.5" aria-hidden="true" /> },
        ]}
      />

      <SegmentedControl
        aria-label="Order mode"
        size="sm"
        value={posMode}
        onChange={onSelectMode}
        options={[
          { value: 'retail', label: 'Retail' },
          { value: 'custom', label: 'Custom' },
        ]}
      />

      <div className="flex items-center gap-2">
        {/*
          Stays on screen after a sale, not just during it. The checkout dialog
          dismisses itself two seconds after confirming, so without this the
          receipt was reachable only by whoever happened to click in time.
        */}
        {lastDocument && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onReopenLastDocument}
            title={`Reopen the receipt for ${lastDocument.document.reference}`}
            leftIcon={<ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />}
            className="max-w-[240px]"
          >
            <span className="truncate">
              Last receipt · <span className="tabular-nums">{lastDocument.label}</span>
            </span>
          </Button>
        )}
      </div>
    </SurfaceCard>
  );
}
