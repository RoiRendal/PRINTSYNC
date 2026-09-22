import { History, ReceiptText, ShoppingBag } from 'lucide-react';
import { Button, SurfaceCard } from '../../../../shared/components/ui';
import { cn } from '../../../../shared/lib/cn';
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
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={view === 'pos' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => onViewChange('pos')}
          leftIcon={<ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          Terminal
        </Button>
        <Button
          variant={view === 'history' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => onViewChange('history')}
          leftIcon={<History className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          History
        </Button>
      </div>

      <div className="flex items-center rounded-full border bg-[var(--app-surface-raised)] p-1 dark:bg-[#3d3d3f]">
        <button
          type="button"
          onClick={() => onSelectMode('retail')}
          className={cn(
            'h-7 cursor-pointer rounded-full px-3 text-[9px] font-bold uppercase tracking-[0.18em]',
            posMode === 'retail'
              ? 'bg-macos-blue text-white'
              : 'text-macos-text-muted hover:bg-[var(--app-state-hover)] dark:text-zinc-400 dark:hover:bg-[#414143]',
          )}
        >
          Retail
        </button>
        <button
          type="button"
          onClick={() => onSelectMode('custom')}
          className={cn(
            'h-7 cursor-pointer rounded-full px-3 text-[9px] font-bold uppercase tracking-[0.18em]',
            posMode === 'custom'
              ? 'bg-macos-purple text-white'
              : 'text-macos-text-muted hover:bg-[var(--app-state-hover)] dark:text-zinc-400 dark:hover:bg-[#414143]',
          )}
        >
          Custom
        </button>
      </div>

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
              Last receipt · <span className="font-mono">{lastDocument.label}</span>
            </span>
          </Button>
        )}
      </div>
    </SurfaceCard>
  );
}
