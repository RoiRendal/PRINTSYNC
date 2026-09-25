import { Package, Plus, Search, Trash2 } from 'lucide-react';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Input,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectCell,
  TableSelectHead,
} from '../../../shared/components/ui';
import { formatSelectedCount } from '../../../shared/lib/selectionLabels';
import type { RowSelection } from '../../../shared/hooks/useRowSelection';
import type { InventoryItem } from '../types';

interface InventoryTableProps {
  items: InventoryItem[];
  totalCount: number;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
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
}

export function InventoryTable({
  items,
  totalCount,
  searchTerm,
  onSearchTermChange,
  onAddItem,
  onEditItem,
  onDeleteSelected,
  selection,
}: InventoryTableProps) {
  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader className="mb-0 flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-end">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:max-w-2xl">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
            <Input className="pl-9 text-xs" placeholder="Search SKU, material or category..." value={searchTerm} onChange={(e) => onSearchTermChange(e.target.value)} />
          </div>
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
          <Button type="button" onClick={onAddItem} leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />} id="add-stock-btn" className="shrink-0">
            Add Stock
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
                  <TableHead colSpan={5} className="font-semibold text-macos-text dark:text-zinc-100">
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
                    <TableCell className="font-mono text-macos-text-muted dark:text-zinc-500">{item.sku}</TableCell>
                    <TableCell className="font-bold text-macos-text dark:text-zinc-100">{item.name}</TableCell>
                    <TableCell className="text-center"><Badge variant="gray">{item.category}</Badge></TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      <span className={isLowStock ? 'text-macos-red dark:text-red-300' : 'text-macos-text dark:text-zinc-100'}>{item.stock}</span>
                      <span className="ml-1 text-[9px] text-macos-text-muted">Units</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-macos-text dark:text-zinc-200">₱{item.price.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-14 text-center">
                    <EmptyState title="No stock items found" icon={<Package className="h-8 w-8 opacity-20" aria-hidden="true" />} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>

      <div className="surface-toolbar flex justify-between px-4 py-3 text-[10px] font-bold text-macos-text-muted dark:text-zinc-500">
        <span>Displaying {items.length} of {totalCount} items</span>
        <span className="hidden opacity-50 sm:inline">PrintSync cloud sync active</span>
      </div>
    </Card>
  );
}
