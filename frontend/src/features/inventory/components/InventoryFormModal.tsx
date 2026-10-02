import React, { useState } from 'react';
import { Image as ImageIcon } from '../../../shared/components/ui/icons';
import { InlineAlert } from '../../../shared/components/feedback/InlineAlert';
import {
  Button,
  Input,
  Modal,
  Select,
} from '../../../shared/components/ui';
import { inventoryApi } from '../api/inventoryApi';
import { readFileAsDataUrl } from '../../../shared/lib/readFileAsDataUrl';
import type { CreateInventoryItem, InventoryItem } from '../types';

/** Mirrors `MAX_INVENTORY_IMAGE_BYTES` in `backend/src/services/inventoryAssetService.ts`. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
/** Mirrors `ALLOWED_IMAGE_CONTENT_TYPES` in `backend/src/services/imageAssetService.ts`. */
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

interface InventoryFormModalProps {
  isOpen: boolean;
  editingItem: InventoryItem | null;
  categories: string[];
  mutationError: string | null;
  onClose: () => void;
  onSubmit: (formData: CreateInventoryItem) => Promise<void>;
}

/*
 * The form tracks the SKU as a string so the input stays controlled, but the
 * request schema rejects a blank one (`min(1)`), so `''` must never reach the
 * API. `''` means "none typed", and the server then generates the SKU — the same
 * contract the edit path already honoured by leaving a blank SKU untouched.
 */
const emptyForm = {
  sku: '',
  name: '',
  category: '',
  stock: 0,
  reorderLevel: 10,
  price: 0,
  costPrice: 0,
  imageUrl: '',
};

type InventoryFormState = typeof emptyForm;

/** Drops a blank SKU so the API receives the key only when it carries a value. */
function toCreatePayload(form: InventoryFormState): CreateInventoryItem {
  const trimmedSku = form.sku.trim();
  const sku = trimmedSku ? { sku: trimmedSku } : {};
  return {
    name: form.name,
    category: form.category,
    stock: form.stock,
    reorderLevel: form.reorderLevel,
    price: form.price,
    costPrice: form.costPrice,
    imageUrl: form.imageUrl || null,
    ...sku,
  };
}

export function InventoryFormModal({
  isOpen,
  editingItem,
  categories,
  mutationError,
  onClose,
  onSubmit,
}: InventoryFormModalProps) {
  const [formData, setFormData] = useState<InventoryFormState>(emptyForm);
  /**
   * The picked file, held until submit. It is NOT read into `formData.imageUrl`
   * the way it used to be: a base64 data URL written into that field is what
   * ended up persisted in `inventory_items.image_url` and shipped back on every
   * list row. The file is uploaded on submit and only the Storage URL is stored.
   */
  const [selectedAsset, setSelectedAsset] = useState<File | null>(null);
  /** Local preview of `selectedAsset`; never sent to the server. */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [assetError, setAssetError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // An object URL pins the whole file in memory until it is released, so this
  // revokes the previous one on every change and on unmount.
  React.useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  // Sync form data when modal opens or editing item changes
  React.useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        setFormData({
          sku: editingItem.sku,
          name: editingItem.name,
          category: editingItem.category,
          stock: editingItem.stock,
          reorderLevel: editingItem.reorderLevel,
          price: editingItem.price,
          costPrice: editingItem.costPrice,
          imageUrl: editingItem.imageUrl || '',
        });
      } else {
        setFormData(emptyForm);
      }
      // A file picked in a previous visit must not be uploaded into the next one.
      setSelectedAsset(null);
      setPreviewUrl(null);
      setAssetError('');
    }
  }, [isOpen, editingItem]);

  const handleAssetSelected = (file: File | undefined) => {
    setAssetError('');
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setAssetError('Use a PNG, JPG, WebP, or SVG image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setAssetError('Keep the image under 2 MB.');
      return;
    }
    setSelectedAsset(file);
    setPreviewUrl(URL.createObjectURL(file));
    // The stored URL is stale the moment a new file is picked; the preview above
    // is what the user sees from here.
    setFormData((previous) => ({ ...previous, imageUrl: '' }));
  };

  const clearImage = () => {
    setSelectedAsset(null);
    setPreviewUrl(null);
    setFormData((previous) => ({ ...previous, imageUrl: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssetError('');
    setIsUploading(true);
    try {
      let imageUrl = formData.imageUrl || null;
      if (selectedAsset) {
        const dataUrl = await readFileAsDataUrl(selectedAsset);
        const uploaded = await inventoryApi.uploadAsset({
          dataUrl,
          fileName: selectedAsset.name,
          contentType: selectedAsset.type,
          sizeBytes: selectedAsset.size,
        });
        imageUrl = uploaded.imageUrl;
      }
      await onSubmit({ ...toCreatePayload(formData), imageUrl });
    } catch (error: unknown) {
      // The item is not saved when the photo fails — silently dropping the image
      // would lose the user's whole edit for the sake of one field.
      setAssetError(error instanceof Error ? error.message : 'The image could not be uploaded.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingItem ? 'Edit Stock Item' : 'Add New Stock'} maxWidth="max-w-3xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="space-y-3">
            <label className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Item Image</label>
            <div className="flex aspect-square max-h-[min(42vh,380px)] w-full items-center justify-center overflow-hidden rounded-[var(--radius-card)] border">
              {previewUrl ?? formData.imageUrl ? (
                <img src={previewUrl ?? formData.imageUrl} alt={formData.name || 'Item preview'} className="h-full w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 p-5 text-center text-app-text-muted dark:text-zinc-500">
                  <ImageIcon className="h-14 w-14 opacity-40" aria-hidden="true" />
                  <span className="text-2xs font-bold">No image yet</span>
                </div>
              )}
            </div>
            <Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="h-auto cursor-pointer py-2 text-xs file:mr-3 file:rounded-full file:border-0 file:bg-app-accent file:px-3 file:py-1.5 file:text-2xs file:font-bold file:text-[var(--app-accent-ink)]" onChange={(event) => handleAssetSelected(event.target.files?.[0])} />
            {selectedAsset && <p className="text-2xs text-app-text-muted dark:text-zinc-500">Selected: {selectedAsset.name}</p>}
            {assetError && <InlineAlert variant="inline" message={assetError} />}
            {(previewUrl || formData.imageUrl) && <Button type="button" variant="danger" size="sm" fullWidth onClick={clearImage}>Remove Image</Button>}
            {editingItem && <p className="text-2xs leading-relaxed text-app-text-muted dark:text-zinc-500">SKU <span className="tabular-nums font-bold text-app-ink dark:text-zinc-200">{editingItem.sku}</span> updates are saved when you submit this dialog.</p>}
          </div>

          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Material Name</span>
              <Input required type="text" placeholder="Premium Cotton T-shirt (Black)" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Category</span>
              <Select required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                <option value="">Select Category</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </Select>
            </label>
            {/*
             * SKU is optional — left blank, the API generates one. It was
             * previously state-only with no input to edit it, so every add
             * submitted a blank SKU (see `toCreatePayload`).
             */}
            <label className="block space-y-1.5">
              <span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">SKU <span className="font-normal normal-case">(optional)</span></span>
              <Input
                data-testid="inventory-sku-input"
                type="text"
                placeholder="Leave blank to generate automatically"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Current Stock</span>
                <Input required type="number" min="0" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Reorder Level</span>
                <Input required type="number" min="0" value={formData.reorderLevel} onChange={(e) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })} />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Unit Price (₱)</span>
              <Input required type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} />
            </label>
          </div>
        </div>

        {mutationError && <InlineAlert message={mutationError} />}

        <div className="flex gap-3 border-t pt-4">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" fullWidth isLoading={isUploading}>{isUploading ? 'Uploading...' : editingItem ? 'Save Changes' : 'Create Item'}</Button>
        </div>
      </form>
    </Modal>
  );
}

