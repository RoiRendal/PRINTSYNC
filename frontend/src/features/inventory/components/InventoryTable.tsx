import { Edit2, Package, Plus, Search, Trash2 } from 'lucide-react';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
} from '../../../shared/components/ui';
import type { InventoryItem } from '../types';

interface InventoryTableProps {
  items: InventoryItem[];
  totalCount: number;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onAddItem: () => void;
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (item: InventoryItem) => void;
}

export function InventoryTable({
  items,
  totalCount,
  searchTerm,
  onSearchTermChange,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: InventoryTableProps) {
  return (
    <Card variant="elevated" padding="none" className="overflow-hidden">
      <CardHeader className="mb-0 flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Stock Catalog</CardTitle>
          <CardDescription>Search SKUs, update materials, and flag reorder thresholds.</CardDescription>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:max-w-xl">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
            <Input className="pl-9 text-xs" placeholder="Search SKU, material or category..." value={searchTerm} onChange={(e) => onSearchTermChange(e.target.value)} />
          </div>
          <Button type="button" onClick={onAddItem} leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />} id="add-stock-btn">
            Add Stock
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <TableContainer className="rounded-none border-0 bg-transparent shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>SKU</TableHead>
                <TableHead>Material Description</TableHead>
                <TableHead className="text-center">Category</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isLowStock = item.stock <= item.reorderLevel;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-macos-text-muted dark:text-zinc-500">{item.sku}</TableCell>
                    <TableCell className="font-bold text-macos-text dark:text-zinc-100">{item.name}</TableCell>
                    <TableCell className="text-center"><Badge variant="gray">{item.category}</Badge></TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      <span className={isLowStock ? 'text-macos-red dark:text-red-300' : 'text-macos-text dark:text-zinc-100'}>{item.stock}</span>
                      <span className="ml-1 text-[9px] text-macos-text-muted">PCS</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-macos-text dark:text-zinc-200">₱{item.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Tooltip content="Edit Item">
                          <Button type="button" variant="ghost" size="icon" onClick={() => onEditItem(item)} className="h-8 w-8">
                            <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="Delete Item">
                          <Button type="button" variant="ghost" size="icon" onClick={() => onDeleteItem(item)} className="h-8 w-8 text-macos-red hover:text-macos-red">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </Tooltip>
                      </div>
                    </TableCell>
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

      <div className="surface-toolbar flex justify-between px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">
        <span>Displaying {items.length} of {totalCount} items</span>
        <span className="hidden opacity-50 sm:inline">PRINTSYNC CLOUD SECURE SYNCED</span>
      </div>
    </Card>
  );
}
