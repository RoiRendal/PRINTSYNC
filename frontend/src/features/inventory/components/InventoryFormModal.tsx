import React, { useState } from 'react';
import { AlertTriangle, Image as ImageIcon } from 'lucide-react';
import {
  Button,
  Input,
  Modal,
  Select,
} from '../../../shared/components/ui';
import type { CreateInventoryItem, InventoryItem } from '../types';

interface InventoryFormModalProps {
  isOpen: boolean;
  editingItem: InventoryItem | null;
  categories: string[];
  mutationError: string | null;
  onClose: () => void;
  onSubmit: (formData: CreateInventoryItem) => Promise<void>;
}

const emptyForm: CreateInventoryItem = {
  name: '',
  category: '',
  stock: 0,
  reorderLevel: 10,
  price: 0,
  imageUrl: '',
};

export function InventoryFormModal({
  isOpen,
  editingItem,
  categories,
  mutationError,
  onClose,
  onSubmit,
}: InventoryFormModalProps) {
  const [formData, setFormData] = useState<CreateInventoryItem>(emptyForm);

  // Sync form data when modal opens or editing item changes
  React.useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        setFormData({
          name: editingItem.name,
          category: editingItem.category,
          stock: editingItem.stock,
          reorderLevel: editingItem.reorderLevel,
          price: editingItem.price,
          imageUrl: editingItem.imageUrl || '',
        });
      } else {
        setFormData(emptyForm);
      }
    }
  }, [isOpen, editingItem]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, imageUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingItem ? 'Edit Stock Item' : 'Add New Stock'} maxWidth="max-w-3xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">Item Image</label>
            <div className="flex aspect-square max-h-[min(42vh,380px)] w-full items-center justify-center overflow-hidden rounded-[var(--radius-card)] border bg-[var(--app-surface-raised)] dark:bg-[#39393b]">
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

        {mutationError && (
          <div className="flex items-center gap-3 rounded-[var(--radius-card)] border bg-[var(--app-tint-red)] p-3 text-xs font-medium text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{mutationError}</span>
          </div>
        )}

        <div className="flex gap-3 border-t pt-4">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button type="submit" fullWidth>{editingItem ? 'Save Changes' : 'Create Item'}</Button>
        </div>
      </form>
    </Modal>
  );
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Deletion" maxWidth="max-w-sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] border bg-[var(--app-tint-red)] p-4 text-red-700 dark:text-red-300">
          <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden="true" />
          <p className="text-xs font-medium">Are you sure you want to delete <span className="font-bold">{item?.name}</span>? This action cannot be undone.</p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button type="button" variant="danger" fullWidth onClick={onConfirm}>Confirm Delete</Button>
        </div>
      </div>
    </Modal>
  );
}
