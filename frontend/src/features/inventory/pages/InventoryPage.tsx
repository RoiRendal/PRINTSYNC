import React, { useMemo, useState } from 'react';
import { AlertTriangle, Box, Edit2, Image as ImageIcon, Package, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { CreateInventoryItem, InventoryItem } from '../types';
import { DesignRepository } from '../../designs/components/DesignRepository';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { useInventory } from '../state/InventoryContext';
import { ApiError } from '../../../shared/api/errors';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  GlassCard,
  Input,
  Modal,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
} from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';

export default function Inventory() {
  const { items, isLoading, error, refresh, addItem, updateItem, deleteItem } = useInventory();
  const [viewMode, setViewMode] = useState<'inventory' | 'designs'>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateInventoryItem>({
    name: '',
    category: '',
    stock: 0,
    reorderLevel: 10,
    price: 0,
    imageUrl: '',
  });

  const filteredItems = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query),
    );
  }, [items, searchTerm]);

  const categories = useMemo(() => {
    return [...new Set([
      'Apparel',
      'Outerwear',
      'Accessories',
      'Consumables',
      'Supplies',
      'Equipment',
      'Packaging',
      ...items.map((item) => item.category),
    ])].filter(Boolean).sort();
  }, [items]);

  const inventoryStats = useMemo(() => {
    const lowStock = items.filter((item) => item.stock <= item.reorderLevel).length;
    const totalStock = items.reduce((sum, item) => sum + item.stock, 0);
    const totalValue = items.reduce((sum, item) => sum + item.stock * item.price, 0);
    return { lowStock, totalStock, totalValue };
  }, [items]);

  const handleOpenModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category,
        stock: item.stock,
        reorderLevel: item.reorderLevel,
        price: item.price,
        imageUrl: item.imageUrl || '',
      });
    } else {
      setEditingItem(null);
      setFormData({ name: '', category: '', stock: 0, reorderLevel: 10, price: 0, imageUrl: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMutationError(null);
    try {
      if (editingItem) {
        await updateItem(editingItem.id, formData);
      } else {
        await addItem(formData);
      }
      handleCloseModal();
    } catch (error: unknown) {
      setMutationError(error instanceof ApiError ? error.message : 'The inventory item could not be saved.');
    }
  };

  const handleDeleteInitiate = (item: InventoryItem) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, imageUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setMutationError(null);
    try {
      await deleteItem(itemToDelete.id);
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (error: unknown) {
      setMutationError(error instanceof ApiError ? error.message : 'The inventory item could not be deleted.');
      setIsDeleteModalOpen(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading inventory" className="min-h-64" />;
  if (error) return <ErrorState message={error} onRetry={refresh} className="min-h-64" />;

  return (
    <div className="space-y-5">
      {mutationError && (
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-macos-red/20 bg-macos-red/10 p-3 text-xs font-medium text-red-700 dark:border-macos-red/25 dark:bg-macos-red/15 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{mutationError}</span>
          <button type="button" onClick={() => setMutationError(null)} className="ml-auto text-red-500 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200">Dismiss</button>
        </div>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/55 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-macos-blue shadow-[var(--shadow-card)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8 dark:text-macos-cyan">
            <Sparkles className="h-3 w-3" aria-hidden="true" /> Asset Control
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-macos-text dark:text-zinc-100 lg:text-[28px]">Inventory Management</h1>
          <p className="mt-1 text-sm text-macos-text-muted dark:text-zinc-400">
            {viewMode === 'inventory' ? 'Manage raw materials, reorder thresholds, and stock valuation.' : 'Digital asset library for custom apparel designs.'}
          </p>
        </div>

        <div className="flex items-center rounded-full border border-white/50 bg-white/55 p-1 shadow-[var(--shadow-card)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
          <button
            type="button"
            onClick={() => setViewMode('inventory')}
            className={cn('flex h-8 cursor-pointer items-center gap-2 rounded-full px-4 text-[10px] font-bold uppercase tracking-[0.18em] transition-all', viewMode === 'inventory' ? 'bg-macos-blue text-white shadow-[0_6px_16px_rgb(0_122_255/0.22)]' : 'text-macos-text-muted hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10')}
          >
            <Box className="h-3.5 w-3.5" aria-hidden="true" /> Stock List
          </button>
          <button
            type="button"
            onClick={() => setViewMode('designs')}
            className={cn('flex h-8 cursor-pointer items-center gap-2 rounded-full px-4 text-[10px] font-bold uppercase tracking-[0.18em] transition-all', viewMode === 'designs' ? 'bg-macos-purple text-white shadow-[0_6px_16px_rgb(175_82_222/0.24)]' : 'text-macos-text-muted hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10')}
          >
            <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /> Design Repo
          </button>
        </div>
      </div>

      {viewMode === 'inventory' ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['Total Stock', inventoryStats.totalStock.toLocaleString(), 'blue'],
              ['Stock Value', `₱${inventoryStats.totalValue.toFixed(2)}`, 'green'],
              ['Low Stock', inventoryStats.lowStock.toLocaleString(), inventoryStats.lowStock > 0 ? 'orange' : 'gray'],
            ].map(([label, value, tone]) => (
              <motion.div key={label} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }}>
                <GlassCard className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">{label}</p>
                  <p className={cn('mt-2 font-mono text-xl font-bold', tone === 'blue' && 'text-macos-blue dark:text-macos-cyan', tone === 'green' && 'text-green-700 dark:text-green-300', tone === 'orange' && 'text-orange-700 dark:text-orange-300', tone === 'gray' && 'text-macos-text dark:text-zinc-100')}>{value}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>

          <Card variant="elevated" padding="none" className="overflow-hidden">
            <CardHeader className="mb-0 flex-col gap-3 border-b border-black/5 p-4 dark:border-white/10 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Stock Catalog</CardTitle>
                <CardDescription>Search SKUs, update materials, and flag reorder thresholds.</CardDescription>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row md:max-w-xl">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
                  <Input className="pl-9 text-xs" placeholder="Search SKU, material or category..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <Button type="button" onClick={() => handleOpenModal()} leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />} id="add-stock-btn">
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
                    {filteredItems.map((item) => {
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
                                <Button type="button" variant="ghost" size="icon" onClick={() => handleOpenModal(item)} className="h-8 w-8">
                                  <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </Button>
                              </Tooltip>
                              <Tooltip content="Delete Item">
                                <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteInitiate(item)} className="h-8 w-8 text-macos-red hover:text-macos-red">
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </Button>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredItems.length === 0 && (
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

            <div className="glass-toolbar flex justify-between px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">
              <span>Displaying {filteredItems.length} of {items.length} items</span>
              <span className="hidden opacity-50 sm:inline">PRINTSYNC CLOUD SECURE SYNCED</span>
            </div>
          </Card>
        </div>
      ) : (
        <DesignRepository />
      )}

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingItem ? 'Edit Stock Item' : 'Add New Stock'} maxWidth="max-w-3xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">Item Image</label>
              <div className="flex aspect-square max-h-[min(42vh,380px)] w-full items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-white/45 bg-white/50 dark:border-white/10 dark:bg-white/6">
                {formData.imageUrl ? (
                  <img src={formData.imageUrl} alt={formData.name || 'Item preview'} className="h-full w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 p-6 text-center text-macos-text-muted dark:text-zinc-500">
                    <ImageIcon className="h-14 w-14 opacity-40" aria-hidden="true" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">No image yet</span>
                  </div>
                )}
              </div>
              <Input type="file" accept="image/*" className="h-auto cursor-pointer py-2 text-xs file:mr-3 file:rounded-full file:border-0 file:bg-macos-blue file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:uppercase file:text-white" onChange={handleImageUpload} />
              {formData.imageUrl && <Button type="button" variant="danger" size="sm" fullWidth onClick={() => setFormData({ ...formData, imageUrl: '' })}>Remove Image</Button>}
              {editingItem && <p className="text-[10px] leading-relaxed text-macos-text-muted dark:text-zinc-500">SKU <span className="font-mono font-bold text-macos-text dark:text-zinc-200">{editingItem.sku}</span> updates are saved when you submit this dialog.</p>}
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">Material Name</span>
                <Input required type="text" placeholder="Premium Cotton T-shirt (Black)" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">Category</span>
                <Select required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                  <option value="">Select Category</option>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </Select>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">Current Stock</span>
                  <Input required type="number" min="0" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })} />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">Reorder Level</span>
                  <Input required type="number" min="0" value={formData.reorderLevel} onChange={(e) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })} />
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">Unit Price (₱)</span>
                <Input required type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} />
              </label>
            </div>
          </div>

          <div className="flex gap-3 border-t border-black/5 pt-4 dark:border-white/10">
            <Button type="button" variant="secondary" fullWidth onClick={handleCloseModal}>Cancel</Button>
            <Button type="submit" fullWidth>{editingItem ? 'Save Changes' : 'Create Item'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Deletion" maxWidth="max-w-sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-macos-red/20 bg-macos-red/10 p-4 text-red-700 dark:border-macos-red/25 dark:bg-macos-red/15 dark:text-red-300">
            <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden="true" />
            <p className="text-xs font-medium">Are you sure you want to delete <span className="font-bold">{itemToDelete?.name}</span>? This action cannot be undone.</p>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" fullWidth onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
            <Button type="button" variant="danger" fullWidth onClick={confirmDelete}>Confirm Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
