import { Button, SegmentedControl, SurfaceCard } from '../../../../shared/components/ui';
import { cn } from '../../../../shared/lib/cn';
import type { PosMode } from '../../hooks/usePOSCart';
import type { PrintableDocument } from '../../types/printableDocument';

export interface POSToolbarProps {
  posMode: PosMode;
  /** Switches mode and resets the basket for the new one. */
  onSelectMode: (mode: PosMode) => void;
  /** The last completed sale, kept printable after the dialog closed. */
  lastDocument: { document: PrintableDocument; label: string } | null;
  onReopenLastDocument: () => void;
  /** Layout the page owns — the till is a fixed-height column, so the bar must
   *  be told not to shrink. */
  className?: string;
}

/**
 * The top bar of the POS screen: the Retail/Custom mode switch and the "Last
 * receipt" button that reopens the paperwork for the most recent sale after the
 * checkout dialog has dismissed itself.
 *
 * The Terminal/History switch used to sit on the left. R6 removed it, and the
 * toggle did not disappear — it moved to the Orders page, where the records are,
 * and became Custom Orders / Retail Sales. Keeping a second switch here that
 * showed nothing would have left two controls claiming to answer one question.
 *
 * Pure presentational — every action is handed back to the page, which owns the
 * state behind it. It exists only to lift this markup out of `POSPage`, which had
 * grown to 900+ lines (R11).
 */
export function POSToolbar({
  posMode,
  onSelectMode,
  lastDocument,
  onReopenLastDocument,
  className,
}: POSToolbarProps) {
  return (
    <SurfaceCard className={cn('flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between', className)}>
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
