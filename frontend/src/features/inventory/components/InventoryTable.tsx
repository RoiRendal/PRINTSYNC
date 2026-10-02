import type { ReactNode } from 'react';
import { Package, Plus, RefreshCw, Trash2 } from '../../../shared/components/ui/icons';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  SearchInput,
  StatusLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectCell,
  TableSelectHead,
  ViewSelect,
  cellTitle,
} from '../../../shared/components/ui';
import type { ViewShape } from '../../../shared/components/ui';
import { formatSelectedCount } from '../../../shared/lib/selectionLabels';
import type { RowSelection } from '../../../shared/hooks/useRowSelection';
import type { InventoryItem } from '../types';

interface InventoryTableProps {
  items: InventoryItem[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  /** Re-reads the stock list from the server. */
  onRefresh: () => void;
  onAddItem: () => void;
  onEditItem: (item: InventoryItem) => void;
  /**
   * Deletes every ticked row. The row's own trash button was removed, so this is
   * the table's only delete path — the one place that can say how many rows it
   * will take with it.
   */
  onDeleteSelected: () => void;
  /** Tick state, owned by the page. See `useRowSelection`. */
  selection: RowSelection;
  /** Which shape this table is currently drawn in. */
  view: ViewShape;
  onViewChange: (view: ViewShape) => void;
  /** Rendered inside the card, below the table — the shared pagination control. */
  footer?: ReactNode;
}

export function InventoryTable({
  items,
  searchTerm,
  onSearchTermChange,
  onRefresh,
  onAddItem,
  onEditItem,
  onDeleteSelected,
  selection,
  view,
  onViewChange,
  footer,
}: InventoryTableProps) {
  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader className="mb-0 flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-end">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:max-w-2xl">
          {/*
            The view picker leads the toolbar row — left of the search box — so
            the established order reads view, search, refresh, delete, add, and
            the dark `+` stays rightmost where the toolbar convention wants it.
            Below `md` this row is a column, so the picker takes its own line
            instead of squeezing the search box.
          */}
          <ViewSelect value={view} onChange={onViewChange} ariaLabel="Stock view" />
          <SearchInput
            className="flex-1"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
          />
          {/*
            Re-reads the list. To the LEFT of delete — the rule for every table
            that has one — so the toolbar reads search, refresh, delete, add.
          */}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={onRefresh}
            aria-label="Refresh"
            title="Refresh"
            className="shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          {/*
            Icon-only, gray, square — the same tone as Cancel. The hover title is
            the only place the user sees *why* it is disabled, so the affordance
            is discoverable rather than appearing out of nowhere once a row is
            ticked.
          */}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            disabled={selection.count === 0}
            onClick={onDeleteSelected}
            aria-label={selection.count > 0 ? `Delete ${selection.count} selected stock item${selection.count === 1 ? '' : 's'}` : 'Delete selected stock items'}
            title={selection.count === 0 ? 'Tick the rows you want to delete first.' : `Delete ${selection.count} stock item${selection.count === 1 ? '' : 's'}`}
            className="shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          {/*
            A bare plus, sitting to the right of the delete square and matching
            its geometry exactly (both `size="icon"`, both a 14px glyph). The plus
            IS the affordance now; the words moved into the accessible name, so a
            screen reader still hears "Add Stock". The primary fill stays — adding
            stock is still this screen's one dominant action (R23), and only the
            label was dropped, not the weight.
          */}
          <Button
            type="button"
            variant="primary"
            size="icon"
            onClick={onAddItem}
            aria-label="Add Stock"
            title="Add Stock"
            id="add-stock-btn"
            className="shrink-0"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <TableContainer className="rounded-none border-0 bg-transparent">
          <Table>
            <colgroup>
              <col style={{ width: '44px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '240px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '110px' }} />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableSelectHead>
                  <Checkbox
                    checked={selection.allSelected}
                    indeterminate={selection.isIndeterminate}
                    disabled={items.length === 0}
                    onChange={selection.toggleAll}
                    aria-label="Select all stock items on this page"
                  />
                </TableSelectHead>
                {/*
                  When rows are ticked the whole header collapses to just the
                  "# items selected" message (ERPNext item-list behaviour); every
                  column label disappears. colSpan 5 = all five data columns.
                */}
                {selection.count === 0 ? (
                  <>
                    <TableHead>SKU</TableHead>
                    <TableHead>Material Description</TableHead>
                    <TableHead className="text-center">Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </>
                ) : (
                  <TableHead colSpan={5} className="font-semibold text-app-ink dark:text-zinc-100">
                    {formatSelectedCount(selection.count)}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isLowStock = item.stock <= item.reorderLevel;
                return (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => onEditItem(item)}>
                    <TableSelectCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selection.has(item.id)}
                        onChange={() => selection.toggle(item.id)}
                        aria-label={`Select ${item.sku}`}
                      />
                    </TableSelectCell>
                    <TableCell className="text-app-text-muted dark:text-zinc-500" title={cellTitle('SKU', item.sku)}>{item.sku}</TableCell>
                    <TableCell className="text-app-ink dark:text-zinc-100" title={cellTitle('Material Description', item.name)}>{item.name}</TableCell>
                    <TableCell className="text-center" title={cellTitle('Category', item.category)}><StatusLabel tone="gray">{item.category}</StatusLabel></TableCell>
                    <TableCell className="text-right tabular-nums" title={cellTitle('Stock', item.stock)}>
                      <span className={isLowStock ? 'text-app-danger dark:text-red-300' : 'text-app-ink dark:text-zinc-100'}>{item.stock}</span>
                    </TableCell>
                    <TableCell
                      className="text-right tabular-nums text-app-ink dark:text-zinc-200"
                      title={cellTitle('Price', `₱${item.price.toFixed(2)}`)}
                    >
                      ₱{item.price.toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="whitespace-normal py-14 text-center">
                    <EmptyState title="No stock items found" icon={<Package className="h-8 w-8 opacity-20" aria-hidden="true" />} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>

      {/*
        No "Displaying N of M items" line and no sync claim any more. Every other
        list table ends in the pagination band alone, and the pager already
        reports "(N total)" — the second count on a second row was the odd one
        out, and "cloud sync active" said nothing a user could act on.
      */}
      {footer ? <div className="border-t px-4 py-3">{footer}</div> : null}
    </Card>
  );
}
