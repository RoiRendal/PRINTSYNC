import React, { useState } from 'react';
import { Calendar, Download, Edit, Eye, Image as ImageIcon, Plus, Search, Tag, Trash2, UploadCloud } from 'lucide-react';

import { designsApi } from '../api/designsApi';
import { useDesigns } from '../../../app/stores/useDesignStore';
import type { CreateDesign, Design } from '../types';
import { DEFAULT_NEW_DESIGN_IMAGE_URL } from '../../../shared/constants/designImages';
import { readFileAsDataUrl } from '../../../shared/lib/readFileAsDataUrl';
import { ApiError } from '../../../shared/api/errors';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, DeleteConfirmModal, SurfaceCard, Input, Modal, Select } from '../../../shared/components/ui';

const DESIGN_CATEGORIES = ['Logo', 'Abstract', 'Typography', 'Graphic', 'Pattern'];

export function DesignRepository() {
  const { designs, isLoading, error, refresh, addDesign, deleteDesign, updateDesign } = useDesigns();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null);
  const [designToDelete, setDesignToDelete] = useState<Design | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newDesign, setNewDesign] = useState<CreateDesign>({ name: '', category: '', imageUrl: '', tags: [], assetType: null, assetSizeBytes: null });
  const [editDesignData, setEditDesignData] = useState<Design | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [editTagInput, setEditTagInput] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<File | null>(null);
  const [assetError, setAssetError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const filteredDesigns = designs.filter((design) =>
    design.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    design.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    design.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssetError('');
    setMutationError(null);
    setIsUploading(true);
    let imageUrl = newDesign.imageUrl || DEFAULT_NEW_DESIGN_IMAGE_URL;
    let assetType: string | null = null;
    let assetSizeBytes: number | null = null;

    try {
      if (selectedAsset) {
        const dataUrl = await readFileAsDataUrl(selectedAsset);
        const uploaded = await designsApi.uploadAsset({
          dataUrl,
          fileName: selectedAsset.name,
          contentType: selectedAsset.type,
          sizeBytes: selectedAsset.size,
        });
        imageUrl = uploaded.imageUrl;
        assetType = uploaded.assetType;
        assetSizeBytes = uploaded.assetSizeBytes;
      }
      await addDesign({ ...newDesign, imageUrl, assetType, assetSizeBytes });
      setNewDesign({ name: '', category: '', imageUrl: '', tags: [], assetType: null, assetSizeBytes: null });
      setSelectedAsset(null);
      setIsAddModalOpen(false);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setMutationError(error.message);
      } else if (error instanceof Error) {
        setAssetError(error.message);
      } else {
        setAssetError('The image could not be uploaded.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleAssetSelected = (file: File | undefined) => {
    setAssetError('');
    if (!file) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setAssetError('Use a PNG, JPG, WebP, or SVG image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAssetError('Keep the image under 5 MB.');
      return;
    }
    setSelectedAsset(file);
    setNewDesign((previous) => ({ ...previous, imageUrl: '' }));
  };

  const handleAddTag = () => {
    if (tagInput.trim()) {
      setNewDesign((prev) => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setNewDesign((prev) => ({ ...prev, tags: prev.tags.filter((tag) => tag !== tagToRemove) }));
  };

  const openViewModal = (design: Design) => {
    setSelectedDesign(design);
    setIsViewModalOpen(true);
  };

  const openEditModal = (design: Design) => {
    setEditDesignData({ ...design });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDesignData) return;
    setMutationError(null);
    try {
      await updateDesign(editDesignData.id, {
        name: editDesignData.name,
        category: editDesignData.category,
        imageUrl: editDesignData.imageUrl,
        tags: editDesignData.tags,
      });
      setIsEditModalOpen(false);
      setEditDesignData(null);
    } catch (error: unknown) {
      setMutationError(error instanceof ApiError ? error.message : 'The design could not be updated.');
    }
  };

  const handleEditAddTag = () => {
    if (editTagInput.trim() && editDesignData) {
      setEditDesignData((prev) => prev ? ({ ...prev, tags: [...prev.tags, editTagInput.trim()] }) : null);
      setEditTagInput('');
    }
  };

  const removeEditTag = (tagToRemove: string) => {
    if (editDesignData) {
      setEditDesignData((prev) => prev ? ({ ...prev, tags: prev.tags.filter((tag) => tag !== tagToRemove) }) : null);
    }
  };

  const confirmDelete = (design: Design) => {
    setDesignToDelete(design);
    setIsDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!designToDelete || isDeleting) return;
    setMutationError(null);
    setIsDeleting(true);
    try {
      await deleteDesign(designToDelete.id);
      setIsDeleteConfirmOpen(false);
      setDesignToDelete(null);
    } catch (error: unknown) {
      setMutationError(error instanceof ApiError ? error.message : 'The design could not be deleted.');
      setIsDeleteConfirmOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading designs" className="min-h-64" />;

  return (
    <div className="space-y-5">
      {error && <ErrorState message={error} onRetry={refresh} />}
      {mutationError && (
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] border bg-[var(--app-tint-red)] p-3 text-xs font-medium text-red-700 dark:text-red-300">
          <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{mutationError}</span>
          <button type="button" onClick={() => setMutationError(null)} className="ml-auto text-red-500 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200">Dismiss</button>
        </div>
      )}

      <Card padding="none" className="overflow-hidden">
        <CardHeader className="mb-0 flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div>

            <CardTitle>Design Repository</CardTitle>
            <CardDescription>Search, upload, and manage reusable artwork assets for custom production.</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:max-w-xl">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
              <Input className="pl-9 text-xs" placeholder="Search designs by name, category or tag..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button onClick={() => setIsAddModalOpen(true)} leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}>Upload Design</Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {filteredDesigns.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
              {filteredDesigns.map((design) => (
                <div key={design.id}>
                  <SurfaceCard className="group overflow-hidden p-0">
                    <div className="relative aspect-square overflow-hidden bg-[#f7f7f7] dark:bg-[#373739]">
                      <img src={design.imageUrl} alt={design.name} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-[var(--app-scrim)] opacity-0 group-hover:opacity-100">
                        <Button type="button" variant="secondary" size="icon" onClick={() => openViewModal(design)} title="View details" className="rounded-full bg-[#3a3a3c] text-white ring-[#6b6b6d] hover:bg-[#525254]">
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button type="button" variant="secondary" size="icon" onClick={() => window.open(design.imageUrl, '_blank', 'noopener,noreferrer')} title="Download design" className="rounded-full bg-[#3a3a3c] text-white ring-[#6b6b6d] hover:bg-[#525254]">
                          <Download className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                      <div className="absolute left-2 top-2"><Badge variant="purple">{design.category}</Badge></div>
                    </div>
                    <div className="space-y-3 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-macos-text dark:text-zinc-100">{design.name}</h3>
                          <p className="mt-1 flex items-center gap-1 text-[10px] text-macos-text-muted dark:text-zinc-500"><Calendar className="h-2.5 w-2.5" aria-hidden="true" /> Added {design.createdAt}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="icon" onClick={() => openEditModal(design)} title="Edit design" className="h-8 w-8"><Edit className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => confirmDelete(design)} title="Delete design" className="h-8 w-8 text-macos-red hover:text-macos-red"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {design.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="gray" className="gap-1"><Tag className="h-2.5 w-2.5" aria-hidden="true" />{tag}</Badge>)}
                        {design.tags.length > 3 && <Badge variant="neutral">+{design.tags.length - 3}</Badge>}
                      </div>
                    </div>
                  </SurfaceCard>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--radius-card)] border border-dashed py-20">
              <EmptyState title="No designs found" message="Try adjusting your search or upload a new design." icon={<ImageIcon className="h-12 w-12 opacity-15" aria-hidden="true" />} className="gap-3" />
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Upload New Design">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <label className="block space-y-1.5"><span className="text-[10px] font-bold text-macos-text-muted dark:text-zinc-500">Design Name</span><Input required type="text" placeholder="Modern Minimalist Logo" value={newDesign.name} onChange={(e) => setNewDesign({ ...newDesign, name: e.target.value })} /></label>
          <label className="block space-y-1.5"><span className="text-[10px] font-bold text-macos-text-muted dark:text-zinc-500">Category</span><Select required value={newDesign.category} onChange={(e) => setNewDesign({ ...newDesign, category: e.target.value })}><option value="">Select Category</option>{DESIGN_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</Select></label>
          <label className="block space-y-1.5"><span className="text-[10px] font-bold text-macos-text-muted dark:text-zinc-500">Upload Image (Optional)</span><Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="h-auto py-2 text-xs file:mr-3 file:rounded-full file:border-0 file:bg-macos-blue file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:text-[var(--app-accent-ink)]" onChange={(event) => handleAssetSelected(event.target.files?.[0])} />{selectedAsset && <p className="text-[10px] text-macos-text-muted dark:text-zinc-500">Selected: {selectedAsset.name}</p>}</label>
          <label className="block space-y-1.5"><span className="text-[10px] font-bold text-macos-text-muted dark:text-zinc-500">Image URL (Optional)</span><Input type="text" placeholder="https://images.unsplash.com/..." value={newDesign.imageUrl} onChange={(e) => setNewDesign({ ...newDesign, imageUrl: e.target.value })} /></label>
          {assetError && <p className="text-[11px] text-macos-red dark:text-red-300">{assetError}</p>}
          <div className="space-y-2">
            <span className="block text-[10px] font-bold text-macos-text-muted dark:text-zinc-500">Tags</span>
            <div className="flex gap-2"><Input type="text" placeholder="Add a tag..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())} /><Button type="button" variant="secondary" onClick={handleAddTag}>Add</Button></div>
            <div className="flex flex-wrap gap-1.5">{newDesign.tags.map((tag) => <Badge key={tag} variant="blue" className="gap-1">{tag}<button type="button" onClick={() => removeTag(tag)} className="cursor-pointer"><Plus className="h-3 w-3 rotate-45" aria-hidden="true" /></button></Badge>)}</div>
          </div>
          <div className="flex gap-3 border-t pt-4"><Button type="button" variant="secondary" fullWidth onClick={() => setIsAddModalOpen(false)}>Cancel</Button><Button type="submit" fullWidth isLoading={isUploading} leftIcon={<UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />}>{isUploading ? 'Uploading...' : 'Upload Design'}</Button></div>
        </form>
      </Modal>

      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title={selectedDesign?.name || 'Design View'} maxWidth="max-w-2xl">
        {selectedDesign && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="aspect-square overflow-hidden rounded-[var(--radius-card)] border"><img src={selectedDesign.imageUrl} alt={selectedDesign.name} className="h-full w-full object-contain" /></div>
            <div className="space-y-4">
              <div><h4 className="mb-1 label-caps text-macos-text-muted">Design Information</h4><p className="text-xl font-bold text-macos-text dark:text-zinc-100">{selectedDesign.name}</p><Badge variant="purple" className="mt-2">{selectedDesign.category}</Badge></div>
              <SurfaceCard className="grid grid-cols-2 gap-4 p-3"><div><p className="text-[9px] text-macos-text-muted">Reference ID</p><p className="font-mono text-sm font-bold text-macos-text dark:text-zinc-200">#{selectedDesign.id}</p></div><div><p className="text-[9px] text-macos-text-muted">Created Date</p><p className="text-sm font-bold text-macos-text dark:text-zinc-200">{selectedDesign.createdAt}</p></div></SurfaceCard>
              <div className="space-y-2"><h4 className="label-caps text-macos-text-muted">Tags</h4><div className="flex flex-wrap gap-1.5">{selectedDesign.tags.map((tag) => <Badge key={tag} variant="gray">{tag}</Badge>)}</div></div>
              <Button fullWidth onClick={() => window.open(selectedDesign.imageUrl, '_blank', 'noopener,noreferrer')} leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}>Download Assets</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Design">
        {editDesignData && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <label className="block space-y-1.5"><span className="text-[10px] font-bold text-macos-text-muted dark:text-zinc-500">Design Name</span><Input required type="text" value={editDesignData.name} onChange={(e) => setEditDesignData({ ...editDesignData, name: e.target.value })} /></label>
            <label className="block space-y-1.5"><span className="text-[10px] font-bold text-macos-text-muted dark:text-zinc-500">Category</span><Select required value={editDesignData.category} onChange={(e) => setEditDesignData({ ...editDesignData, category: e.target.value })}><option value="">Select Category</option>{DESIGN_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</Select></label>
            <label className="block space-y-1.5"><span className="text-[10px] font-bold text-macos-text-muted dark:text-zinc-500">Image URL</span><Input type="text" value={editDesignData.imageUrl} onChange={(e) => setEditDesignData({ ...editDesignData, imageUrl: e.target.value })} /></label>
            <div className="space-y-2"><span className="block text-[10px] font-bold text-macos-text-muted dark:text-zinc-500">Tags</span><div className="flex gap-2"><Input type="text" placeholder="Add a tag..." value={editTagInput} onChange={(e) => setEditTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleEditAddTag())} /><Button type="button" variant="secondary" onClick={handleEditAddTag}>Add</Button></div><div className="flex flex-wrap gap-1.5">{editDesignData.tags.map((tag) => <Badge key={tag} variant="blue" className="gap-1">{tag}<button type="button" onClick={() => removeEditTag(tag)} className="cursor-pointer"><Plus className="h-3 w-3 rotate-45" aria-hidden="true" /></button></Badge>)}</div></div>
            <div className="flex gap-3 border-t pt-4"><Button type="button" variant="secondary" fullWidth onClick={() => setIsEditModalOpen(false)}>Cancel</Button><Button type="submit" fullWidth>Save Changes</Button></div>
          </form>
        )}
      </Modal>

      <DeleteConfirmModal
        isOpen={isDeleteConfirmOpen}
        itemLabels={designToDelete ? [designToDelete.name] : []}
        isBusy={isDeleting}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
